import type { Request, Response, NextFunction } from 'express';
import { generateTokens, verifyRefreshToken } from '@agentest/auth';
import { prisma } from '@agentest/db';
import {
  AuthenticationError,
  ValidationError,
  userLoginSchema,
  userRegisterSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from '@agentest/shared';
import { env } from '../config/env.js';
import { SessionService } from '../services/session.service.js';
import { UserPasswordAuthService } from '../services/user-password-auth.service.js';
import { emailService } from '../services/email.service.js';
import { extractClientInfo } from '../middleware/session.middleware.js';
import { encryptToken } from '../utils/crypto.js';
import { hashToken } from '../utils/pkce.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'auth-controller' });

const authConfig = {
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiry: env.JWT_REFRESH_EXPIRES_IN,
  },
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
  oauth: {},
};

// クッキー設定
const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};

// セッション有効期限（7日）
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// OAuth連携追加モードを示すクッキー名
const LINK_MODE_COOKIE = 'oauth_link_mode';

// 連携追加モードのクッキー情報
interface LinkModeInfo {
  provider: string;
  userId: string;
}

/**
 * Zodパース結果からValidationErrorを生成するヘルパー
 */
function createValidationError(error: import('zod').ZodError): ValidationError {
  const fieldErrors = error.flatten().fieldErrors;
  const details: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(fieldErrors)) {
    if (value) {
      details[key] = value;
    }
  }
  return new ValidationError('入力内容に誤りがあります', details);
}

/**
 * 認証コントローラー
 */
export class AuthController {
  private sessionService = new SessionService();
  private passwordAuthService = new UserPasswordAuthService();

  /**
   * 現在のユーザー情報を取得
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthenticationError('認証が必要です');
      }

      res.json({
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          avatarUrl: req.user.avatarUrl,
          plan: req.user.plan,
          createdAt: req.user.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * トークンリフレッシュ
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // クッキーまたはボディからリフレッシュトークンを取得
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;

      if (!refreshToken) {
        throw new AuthenticationError('リフレッシュトークンが必要です');
      }

      // トークンを検証
      const payload = verifyRefreshToken(refreshToken, authConfig);
      const refreshTokenHash = hashToken(refreshToken);

      // ユーザーを取得
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || user.deletedAt) {
        throw new AuthenticationError('ユーザーが見つかりません');
      }

      // 新しいトークンを生成
      const tokens = generateTokens(user.id, user.email, authConfig);
      const newTokenHash = hashToken(tokens.refreshToken);
      const clientInfo = extractClientInfo(req);

      // トランザクションで旧トークン失効と新トークン作成をアトミックに実行
      await prisma.$transaction(async (tx) => {
        // 旧リフレッシュトークンを失効（楽観的ロック: revokedAt が null のもののみ更新）
        const revokeResult = await tx.refreshToken.updateMany({
          where: {
            tokenHash: refreshTokenHash,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { revokedAt: new Date() },
        });

        // 更新件数が0 = 既に無効化済み or 期限切れ or 存在しない
        if (revokeResult.count === 0) {
          throw new AuthenticationError('無効なリフレッシュトークンです');
        }

        // 旧セッションを失効
        await tx.session.updateMany({
          where: { tokenHash: refreshTokenHash },
          data: { revokedAt: new Date() },
        });

        // 新しいリフレッシュトークンとセッションを保存（ハッシュ化して保存）
        await Promise.all([
          tx.refreshToken.create({
            data: {
              userId: user.id,
              tokenHash: newTokenHash,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
          tx.session.create({
            data: {
              userId: user.id,
              tokenHash: newTokenHash,
              userAgent: clientInfo.userAgent,
              ipAddress: clientInfo.ipAddress,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
        ]);
      });

      // クッキーに設定（生トークン）
      this.setAuthCookies(res, tokens);

      res.json({ message: 'トークンが更新されました' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ログアウト
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refresh_token;

      if (refreshToken) {
        // リフレッシュトークンとセッションを無効化（ハッシュで検索）
        const tokenHash = hashToken(refreshToken);
        await Promise.all([
          prisma.refreshToken.updateMany({
            where: { tokenHash },
            data: { revokedAt: new Date() },
          }),
          prisma.session.updateMany({
            where: { tokenHash },
            data: { revokedAt: new Date() },
          }),
        ]);
      }

      // クッキーをクリア
      res.clearCookie('access_token', { path: '/' });
      res.clearCookie('refresh_token', { path: '/' });

      res.json({ message: 'ログアウトしました' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メール/パスワードログイン
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = userLoginSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      const clientInfo = extractClientInfo(req);
      const result = await this.passwordAuthService.login({
        email: parsed.data.email,
        password: parsed.data.password,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      });

      this.setAuthCookies(res, result.tokens);
      res.json({ user: result.user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メール/パスワード新規登録
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = userRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      const clientInfo = extractClientInfo(req);
      const result = await this.passwordAuthService.register({
        email: parsed.data.email,
        password: parsed.data.password,
        name: parsed.data.name,
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      });

      this.setAuthCookies(res, result.tokens);

      // ウェルカムメール送信（非同期、失敗してもエラーにしない）
      const welcomeEmail = emailService.generateWelcomeEmail({
        name: result.user.name,
        loginUrl: `${env.FRONTEND_URL}/login`,
      });
      emailService.send({
        to: result.user.email,
        subject: welcomeEmail.subject,
        text: welcomeEmail.text,
        html: welcomeEmail.html,
      }).catch((error) => {
        logger.warn({ userId: result.user.id, email: result.user.email, error }, 'ウェルカムメール送信失敗');
      });

      res.status(201).json({ user: result.user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * パスワードリセット要求
   */
  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = passwordResetRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      // バックグラウンドで処理し、即座にレスポンスを返す（タイミングサイドチャネル対策）
      const resetPromise = (async () => {
        const resetToken = await this.passwordAuthService.requestPasswordReset(parsed.data.email);

        // トークンがある場合はリセットメールを送信
        if (resetToken) {
          const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
          const resetEmail = emailService.generatePasswordResetEmail({
            name: parsed.data.email,
            resetUrl,
            expiresInMinutes: 60,
          });
          await emailService.send({
            to: parsed.data.email,
            subject: resetEmail.subject,
            text: resetEmail.text,
            html: resetEmail.html,
          });
        }
      })();

      // エラーをログに記録（レスポンスには影響させない）
      resetPromise.catch((error) => {
        logger.error({ email: parsed.data.email, error }, 'パスワードリセット処理エラー');
      });

      // 常に即座に同じメッセージを返す（メール存在確認防止 + タイミング差排除）
      res.json({
        message: 'パスワードリセット用のメールを送信しました。メールをご確認ください。',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * パスワードリセット実行
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = passwordResetSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      await this.passwordAuthService.resetPassword(parsed.data.token, parsed.data.password);

      res.json({
        message: 'パスワードがリセットされました。新しいパスワードでログインしてください。',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 認証クッキーを設定する共通メソッド
   */
  private setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }): void {
    res.cookie('access_token', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15分
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: SESSION_EXPIRY_MS,
    });
  }

  /**
   * OAuthコールバック処理
   *
   * 連携追加モード（クッキーにoauth_link_modeがある場合）と
   * 通常ログインモードの両方を処理する
   */
  oauthCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // OAuth コールバックでは req.user は { userId, email, profile } 形式
      const oauthUser = req.user as {
        userId: string;
        email: string;
        profile?: { provider: string; providerAccountId: string };
      } | undefined;

      if (!oauthUser || !oauthUser.userId) {
        throw new AuthenticationError('OAuth認証に失敗しました');
      }

      // 連携追加モードかどうかをクッキーで判定
      const linkModeCookie = req.cookies?.[LINK_MODE_COOKIE];
      if (linkModeCookie) {
        // 連携追加モードのクッキーをクリア
        res.clearCookie(LINK_MODE_COOKIE, { path: '/' });

        try {
          const linkMode: LinkModeInfo = JSON.parse(linkModeCookie);

          // プロバイダーが一致するか確認
          if (oauthUser.profile && linkMode.provider === oauthUser.profile.provider) {
            // 連携追加処理を実行
            const result = await this.handleOAuthLink(linkMode.userId, oauthUser.profile);

            if (!result.success) {
              res.redirect(`${env.FRONTEND_URL}/settings?tab=security&link=error&message=${encodeURIComponent(result.error || '連携に失敗しました')}`);
              return;
            }

            // 連携成功
            res.redirect(`${env.FRONTEND_URL}/settings?tab=security&link=success`);
            return;
          }
        } catch {
          // クッキーのパースに失敗した場合は通常ログインとして処理
        }
      }

      // 通常のログイン処理
      // トークンを生成
      const tokens = generateTokens(oauthUser.userId, oauthUser.email, authConfig);

      // クライアント情報を抽出
      const clientInfo = extractClientInfo(req);

      // リフレッシュトークンとセッションを保存（ハッシュ化して保存）
      const tokenHash = hashToken(tokens.refreshToken);
      await Promise.all([
        prisma.refreshToken.create({
          data: {
            userId: oauthUser.userId,
            tokenHash,
            expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
          },
        }),
        this.sessionService.createSession({
          userId: oauthUser.userId,
          tokenHash,
          userAgent: clientInfo.userAgent,
          ipAddress: clientInfo.ipAddress,
          expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
        }),
      ]);

      // クッキーに設定（生トークン）
      this.setAuthCookies(res, tokens);

      // フロントエンドにリダイレクト（CORS_ORIGINは複数値の可能性があるためFRONTEND_URLを使用）
      res.redirect(`${env.FRONTEND_URL}/auth/callback`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * OAuth連携追加処理
   *
   * 既存ユーザーに新しいOAuthプロバイダーを連携する
   */
  private handleOAuthLink = async (
    userId: string,
    profile: { provider: string; providerAccountId: string; accessToken?: string; refreshToken?: string }
  ): Promise<{ success: boolean; error?: string }> => {
    // 同じプロバイダーアカウントが他のユーザーに紐づいていないか確認
    const existingAccount = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
    });

    if (existingAccount) {
      if (existingAccount.userId === userId) {
        return { success: false, error: `この${profile.provider}アカウントは既に連携されています` };
      } else {
        return { success: false, error: `この${profile.provider}アカウントは別のユーザーに連携されています` };
      }
    }

    // 同じユーザー・プロバイダーの組み合わせが存在しないか確認
    const duplicateProvider = await prisma.account.findUnique({
      where: {
        userId_provider: { userId, provider: profile.provider },
      },
    });

    if (duplicateProvider) {
      return { success: false, error: `${profile.provider}は既に別のアカウントで連携されています` };
    }

    // 新しい連携を作成（トークンは暗号化して保存）
    await prisma.account.create({
      data: {
        userId,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        accessToken: encryptToken(profile.accessToken, env.TOKEN_ENCRYPTION_KEY),
        refreshToken: encryptToken(profile.refreshToken, env.TOKEN_ENCRYPTION_KEY),
      },
    });

    return { success: true };
  };
}
