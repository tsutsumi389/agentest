import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { generateTokens, verifyRefreshToken } from '@agentest/auth';
import { prisma } from '@agentest/db';
import {
  AuthenticationError,
  BadRequestError,
  userLoginSchema,
  userRegisterSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from '@agentest/shared';
import { authConfig, SESSION_EXPIRY_MS, LINK_MODE_COOKIE } from '../config/auth.js';
import { env } from '../config/env.js';
import { UserPasswordAuthService } from '../services/user-password-auth.service.js';
import { UserTotpService } from '../services/user-totp.service.js';
import { emailService } from '../services/email.service.js';
import { extractClientInfo } from '../middleware/session.middleware.js';
import { encryptToken } from '../utils/crypto.js';
import { hashToken } from '../utils/pkce.js';
import { createValidationError } from '../utils/validation.js';
import { getUserIdByTwoFactorToken, deleteUserTwoFactorToken } from '../lib/redis-store.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'auth-controller' });

// 連携追加モードのクッキー情報
interface LinkModeInfo {
  provider: string;
  userId: string;
}

// 2FA検証リクエストのバリデーション
const twoFactorVerifySchema = z.object({
  twoFactorToken: z.string().min(1, '2FAトークンを入力してください'),
  code: z.string().regex(/^\d{6}$/, 'TOTPコードは6桁の数字で入力してください'),
});

/**
 * 認証コントローラー
 */
export class AuthController {
  private passwordAuthService = new UserPasswordAuthService();
  private totpService = new UserTotpService();

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
          createdAt: req.user.createdAt,
          totpEnabled: req.user.totpEnabled,
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
   *
   * 2FA有効ユーザー: JWTを発行せず、一時トークンを返却
   * 2FA無効ユーザー: 従来通りJWTをクッキーに設定
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

      // 2FA有効: クッキー未設定、一時トークンを返却
      if (result.requires2FA) {
        res.json({
          requires2FA: true,
          twoFactorToken: result.twoFactorToken,
        });
        return;
      }

      // 2FA無効: 従来通りJWTをクッキーに設定
      this.setAuthCookies(res, result.tokens);
      res.json({ user: result.user });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 2FA検証（ログイン時の第2ステップ）
   * POST /api/auth/2fa/verify
   *
   * twoFactorTokenとTOTPコードを受け取り、検証成功でJWTを発行する。
   * requireAuthミドルウェアは使用しない（JWT未発行状態で呼ばれるため）。
   */
  verifyTwoFactor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = twoFactorVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      const { twoFactorToken, code } = parsed.data;

      // Redisから一時トークンでユーザーIDを取得
      const userId = await getUserIdByTwoFactorToken(twoFactorToken);
      if (!userId) {
        throw new AuthenticationError('2FAトークンが無効または期限切れです');
      }

      // ワンタイム使用を保証: 検証前にトークンを削除
      await deleteUserTwoFactorToken(twoFactorToken);

      // TOTPコード検証（失敗してもトークンは既に消費済み）
      const clientInfo = extractClientInfo(req);
      await this.totpService.verifyTotp(userId, code, clientInfo.ipAddress, clientInfo.userAgent);

      // ユーザー情報を取得
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      if (!user || user.deletedAt) {
        throw new AuthenticationError('ユーザーが見つかりません');
      }

      // JWT発行 + セッション作成（トランザクションでアトミックに実行）
      const tokens = generateTokens(user.id, user.email, authConfig);
      const tokenHash = hashToken(tokens.refreshToken);

      await prisma.$transaction(async (tx) => {
        await Promise.all([
          tx.refreshToken.create({
            data: {
              userId: user.id,
              tokenHash,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
          tx.session.create({
            data: {
              userId: user.id,
              tokenHash,
              userAgent: clientInfo.userAgent,
              ipAddress: clientInfo.ipAddress,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
        ]);
      });

      // クッキーにJWT設定
      this.setAuthCookies(res, tokens);

      logger.info({ userId: user.id }, '2FA検証成功、ログイン完了');

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          totpEnabled: user.totpEnabled,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メール/パスワード新規登録
   *
   * REQUIRE_EMAIL_VERIFICATION=true: JWT発行せず、確認メールを送信
   * REQUIRE_EMAIL_VERIFICATION=false: JWT即発行、クッキー設定
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

      // メール認証スキップ時: クッキー設定して即ログイン状態にする
      if (!result.requiresEmailVerification) {
        this.setAuthCookies(res, result.tokens);
        res.status(201).json({
          message: 'アカウントが作成されました。',
          user: result.user,
          emailVerificationSkipped: true,
        });
        return;
      }

      // メール認証あり: 確認メール送信（非同期、失敗してもエラーにしない）
      const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${result.verificationToken}`;
      const verificationEmail = emailService.generateEmailVerificationEmail({
        name: result.user.name,
        verificationUrl,
        expiresInHours: 24,
      });
      emailService
        .send({
          to: result.user.email,
          subject: verificationEmail.subject,
          text: verificationEmail.text,
          html: verificationEmail.html,
        })
        .catch((error) => {
          logger.warn(
            { userId: result.user.id, email: result.user.email, error },
            '確認メール送信失敗'
          );
        });

      res.status(201).json({
        message: '確認メールを送信しました。メールをご確認ください。',
        user: result.user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メールアドレス確認
   */
  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.query.token as string;
      if (!token) {
        throw new BadRequestError('トークンが必要です');
      }

      await this.passwordAuthService.verifyEmail(token);

      res.json({
        message: 'メールアドレスが確認されました。ログインしてください。',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * メールアドレス確認メール再送信
   *
   * forgotPasswordと同じ火消し型パターン（成功/失敗に関わらず同一レスポンス）
   */
  resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = passwordResetRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createValidationError(parsed.error);
      }

      // バックグラウンドで処理し、即座にレスポンスを返す（タイミングサイドチャネル対策）
      const resendPromise = (async () => {
        const verificationToken = await this.passwordAuthService.resendVerification(
          parsed.data.email
        );

        // トークンがある場合は確認メールを送信
        if (verificationToken) {
          const verificationUrl = `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
          const verificationEmail = emailService.generateEmailVerificationEmail({
            name: parsed.data.email,
            verificationUrl,
            expiresInHours: 24,
          });
          await emailService.send({
            to: parsed.data.email,
            subject: verificationEmail.subject,
            text: verificationEmail.text,
            html: verificationEmail.html,
          });
        }
      })();

      // エラーをログに記録（レスポンスには影響させない）
      resendPromise.catch((error) => {
        logger.error({ email: parsed.data.email, error }, '確認メール再送信処理エラー');
      });

      // 常に即座に同じメッセージを返す（メール存在確認防止 + タイミング差排除）
      res.json({
        message: '確認メールを送信しました。メールをご確認ください。',
      });
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
  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string }
  ): void {
    res.cookie('access_token', tokens.accessToken, {
      ...authConfig.cookie,
      maxAge: 15 * 60 * 1000, // 15分
    });
    res.cookie('refresh_token', tokens.refreshToken, {
      ...authConfig.cookie,
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
      const oauthUser = req.user as
        | {
            userId: string;
            email: string;
            profile?: { provider: string; providerAccountId: string };
          }
        | undefined;

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
              res.redirect(
                `${env.FRONTEND_URL}/settings?tab=security&link=error&message=${encodeURIComponent(result.error || '連携に失敗しました')}`
              );
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
      await prisma.$transaction(async (tx) => {
        await Promise.all([
          tx.refreshToken.create({
            data: {
              userId: oauthUser.userId,
              tokenHash,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
          tx.session.create({
            data: {
              userId: oauthUser.userId,
              tokenHash,
              userAgent: clientInfo.userAgent,
              ipAddress: clientInfo.ipAddress,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
        ]);
      });

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
    profile: {
      provider: string;
      providerAccountId: string;
      accessToken?: string;
      refreshToken?: string;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    // 両方のユニーク制約を並列で確認
    const [existingAccount, duplicateProvider] = await Promise.all([
      prisma.account.findUnique({
        where: {
          provider_providerAccountId: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
          },
        },
      }),
      prisma.account.findUnique({
        where: {
          userId_provider: { userId, provider: profile.provider },
        },
      }),
    ]);

    if (existingAccount) {
      if (existingAccount.userId === userId) {
        return { success: false, error: `この${profile.provider}アカウントは既に連携されています` };
      } else {
        return {
          success: false,
          error: `この${profile.provider}アカウントは別のユーザーに連携されています`,
        };
      }
    }

    if (duplicateProvider) {
      return { success: false, error: `${profile.provider}は既に別のアカウントで連携されています` };
    }

    // 新しい連携を作成（ユニーク制約違反をハンドルしてTOCTOU race conditionに対応）
    try {
      await prisma.account.create({
        data: {
          userId,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          accessToken: encryptToken(profile.accessToken, env.TOKEN_ENCRYPTION_KEY),
          refreshToken: encryptToken(profile.refreshToken, env.TOKEN_ENCRYPTION_KEY),
        },
      });
    } catch (error) {
      // Prismaのユニーク制約違反（P2002）をユーザーフレンドリーなメッセージに変換
      if (
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        return { success: false, error: `この${profile.provider}アカウントは既に連携されています` };
      }
      throw error;
    }

    return { success: true };
  };
}
