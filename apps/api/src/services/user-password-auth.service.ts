import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma, type Prisma } from '@agentest/db';
import { generateTokens, type TokenPair } from '@agentest/auth';
import { AppError, AuthenticationError, ConflictError, BadRequestError } from '@agentest/shared';
import { env } from '../config/env.js';
import { authConfig } from '../config/auth.js';
import { hashToken } from '../utils/pkce.js';
import { setUserTwoFactorToken } from '../lib/redis-store.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'user-password-auth' });

// bcryptのコストファクター
const BCRYPT_ROUNDS = 12;
// 最大ログイン失敗回数
const MAX_FAILED_ATTEMPTS = 5;
// アカウントロック時間（30分）
const LOCK_DURATION_MS = 30 * 60 * 1000;
// パスワードリセットトークンの有効期限（1時間）
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
// セッション有効期限（7日）
const SESSION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
// メールアドレス確認トークンの有効期限（24時間）
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;
// タイミング攻撃対策用のダミーハッシュ（有効なbcrypt形式）
const DUMMY_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4bEaLwrMlxAqP6C2';

/**
 * ログイン結果（判別共用体）
 *
 * 2FA無効: JWTトークンペア + ユーザー情報
 * 2FA有効: 一時トークン（JWT未発行）
 */
export type LoginResult =
  | { requires2FA: false; tokens: TokenPair; user: { id: string; email: string; name: string } }
  | { requires2FA: true; twoFactorToken: string };

/**
 * 登録結果（判別共用体）
 *
 * メール認証あり: 確認トークンを返す（JWT未発行）
 * メール認証スキップ: JWTトークンペアを即発行
 */
export type RegisterResult =
  | {
      requiresEmailVerification: true;
      verificationToken: string;
      user: { id: string; email: string; name: string };
    }
  | {
      requiresEmailVerification: false;
      tokens: TokenPair;
      user: { id: string; email: string; name: string };
    };

/**
 * ユーザーパスワード認証サービス
 *
 * メール/パスワード認証のコアビジネスロジック。
 * Admin側の admin-auth.service.ts のパターン（bcrypt, アカウントロック, タイミング攻撃対策）を再利用し、
 * User側はJWT方式で認証する。
 */
export class UserPasswordAuthService {
  /**
   * パスワードをbcryptでハッシュ化
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * パスワードを検証
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * 新規ユーザー登録
   *
   * REQUIRE_EMAIL_VERIFICATION=true（デフォルト）: メール確認待ち、JWT未発行
   * REQUIRE_EMAIL_VERIFICATION=false: emailVerified=true で即JWT発行
   */
  async register(input: {
    email: string;
    password: string;
    name: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<RegisterResult> {
    const { email, password, name, ipAddress, userAgent } = input;

    // メールアドレス重複チェック
    const existing = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictError('このメールアドレスは既に登録されています');
    }

    // パスワードハッシュ化
    const passwordHash = await this.hashPassword(password);

    // メール認証スキップ時: emailVerified=true で作成し、JWT即発行
    if (!env.REQUIRE_EMAIL_VERIFICATION) {
      const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const user = await tx.user.create({
          data: {
            email,
            name,
            passwordHash,
            emailVerified: true,
          },
        });

        // JWT発行 + セッション作成
        const tokens = generateTokens(user.id, user.email, authConfig);
        const tokenHash = hashToken(tokens.refreshToken);

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
              userAgent,
              ipAddress,
              expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
            },
          }),
        ]);

        return { user, tokens };
      });

      logger.info({ userId: created.user.id, email }, 'ユーザー登録完了（メール認証スキップ）');

      return {
        requiresEmailVerification: false,
        tokens: created.tokens,
        user: {
          id: created.user.id,
          email: created.user.email,
          name: created.user.name,
        },
      };
    }

    // メール認証あり（デフォルト）: 確認トークン生成
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // トランザクションでユーザー作成と確認トークン保存をアトミックに実行
    const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
        },
      });

      // EmailVerificationTokenを保存
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS),
        },
      });

      return user;
    });

    logger.info({ userId: created.id, email }, 'ユーザー登録完了（メール確認待ち）');

    return {
      requiresEmailVerification: true,
      verificationToken: rawToken,
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
      },
    };
  }

  /**
   * ログイン
   *
   * セキュリティ対策:
   * - ユーザー不存在時もbcrypt実行でタイミング攻撃を防止
   * - 5回失敗でアカウントを30分ロック
   */
  async login(input: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<LoginResult> {
    const { email, password, ipAddress, userAgent } = input;

    // ユーザー検索
    let user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    // タイミング攻撃対策: ユーザーが存在しなくてもbcrypt処理を実行
    if (!user) {
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new AuthenticationError('メールアドレスまたはパスワードが正しくありません');
    }

    // アカウントロックチェック
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AuthenticationError(
        'アカウントがロックされています。しばらく経ってから再度お試しください'
      );
    }

    // ロック期間が終了している場合、失敗回数をリセット
    if (user.lockedUntil && user.lockedUntil <= new Date()) {
      const unlocked = await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
      user = {
        ...user,
        failedAttempts: unlocked.failedAttempts,
        lockedUntil: unlocked.lockedUntil,
      };
    }

    // passwordHashがnull（OAuthのみユーザー）の場合
    if (!user.passwordHash) {
      // タイミング攻撃対策: ダミーハッシュと比較
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      throw new AuthenticationError('メールアドレスまたはパスワードが正しくありません');
    }

    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // トランザクションで失敗回数インクリメントとロック設定をアトミックに実行
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const updated = await tx.user.update({
          where: { id: user.id },
          data: { failedAttempts: { increment: 1 } },
        });

        // 最大試行回数を超えた場合はロック
        if (updated.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
          await tx.user.update({
            where: { id: user.id },
            data: { lockedUntil },
          });

          logger.warn({ userId: user.id, email }, 'アカウントがロックされました');
        }
      });

      throw new AuthenticationError('メールアドレスまたはパスワードが正しくありません');
    }

    // メールアドレス確認チェック
    if (!user.emailVerified) {
      throw new AppError(
        401,
        'EMAIL_NOT_VERIFIED',
        'メールアドレスが確認されていません。受信トレイの確認メールをご確認ください'
      );
    }

    // 2FA有効ユーザー: JWTを発行せず、一時トークンをRedisに保存して返す
    if (user.totpEnabled) {
      const twoFactorToken = crypto.randomBytes(32).toString('hex');
      const stored = await setUserTwoFactorToken(user.id, twoFactorToken);
      if (!stored) {
        throw new AppError(
          500,
          'INTERNAL_ERROR',
          '2FA認証の準備に失敗しました。しばらく経ってから再度お試しください'
        );
      }

      // パスワード認証成功: 失敗回数をリセット
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });

      logger.info({ userId: user.id, email }, 'ログイン成功（2FA検証待ち）');

      return { requires2FA: true, twoFactorToken };
    }

    // 2FA無効ユーザー: 従来通りJWT発行
    const tokens = generateTokens(user.id, user.email, authConfig);
    const tokenHash = hashToken(tokens.refreshToken);

    // トランザクションで失敗回数リセットとトークン保存をアトミックに実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // ログイン成功: 失敗回数をリセット
      await tx.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      // RefreshTokenとSessionを保存
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
            userAgent,
            ipAddress,
            expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS),
          },
        }),
      ]);
    });

    logger.info({ userId: user.id, email }, 'ログイン成功');

    return {
      requires2FA: false,
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  /**
   * パスワードリセット要求
   *
   * セキュリティ対策:
   * - ユーザーが存在しない場合もエラーを投げない（メール存在確認防止）
   * - OAuthのみユーザーの場合もエラーを投げない
   */
  async requestPasswordReset(email: string): Promise<string | null> {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    // ユーザーが存在しない、またはOAuthのみユーザーの場合はnullを返す
    if (!user || !user.passwordHash) {
      return null;
    }

    // リセットトークン生成
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // トランザクションで既存トークン無効化と新規トークン作成をアトミックに実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 同一ユーザーの既存未使用トークンを無効化
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // 新しいトークンをDBに保存
      await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
        },
      });
    });

    logger.info({ userId: user.id, email }, 'パスワードリセットトークン生成');

    return rawToken;
  }

  /**
   * パスワードリセット実行
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);

    // トークンを検索
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    // トークンが存在しない
    if (!resetToken) {
      throw new BadRequestError('無効なパスワードリセットトークンです');
    }

    // トークンが使用済み
    if (resetToken.usedAt) {
      throw new BadRequestError('このパスワードリセットトークンは既に使用されています');
    }

    // トークンが期限切れ
    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestError('パスワードリセットトークンの有効期限が切れています');
    }

    // パスワードハッシュ化
    const passwordHash = await this.hashPassword(newPassword);

    // トランザクションで実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // トークンを使用済みにする
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // パスワード更新 + ロック解除 + 失敗回数リセット
      await tx.user.update({
        where: { id: resetToken.userId },
        data: {
          passwordHash,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      // 全セッションを無効化
      await tx.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await tx.session.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });

    logger.info({ userId: resetToken.userId }, 'パスワードリセット完了');
  }

  /**
   * パスワード初回設定（OAuthユーザーがパスワードを追加）
   */
  async setPassword(userId: string, password: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestError('ユーザーが見つかりません');
    }

    // 既にパスワードが設定済みの場合はエラー
    if (user.passwordHash) {
      throw new ConflictError(
        'パスワードは既に設定されています。変更する場合はパスワード変更機能を使用してください'
      );
    }

    const passwordHash = await this.hashPassword(password);

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    logger.info({ userId }, 'パスワード初回設定完了');
  }

  /**
   * パスワード変更
   *
   * セキュリティ対策:
   * - パスワード変更後、現在のセッション以外を全て無効化
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentTokenHash?: string
  ): Promise<void> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestError('ユーザーが見つかりません');
    }

    // パスワード未設定の場合
    if (!user.passwordHash) {
      throw new BadRequestError(
        'パスワードが設定されていません。パスワード設定機能を使用してください'
      );
    }

    // 現在のパスワードを検証
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('現在のパスワードが正しくありません');
    }

    const passwordHash = await this.hashPassword(newPassword);

    // トランザクションでパスワード更新と他セッション無効化をアトミックに実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      // 現在のセッション以外のリフレッシュトークンを無効化
      await tx.refreshToken.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt: new Date() },
      });

      // 現在のセッション以外のセッションを無効化
      await tx.session.updateMany({
        where: {
          userId,
          revokedAt: null,
          ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
        },
        data: { revokedAt: new Date() },
      });
    });

    logger.info({ userId }, 'パスワード変更完了（他セッション無効化済み）');
  }

  /**
   * パスワード設定状況確認
   */
  async hasPassword(userId: string): Promise<boolean> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new BadRequestError('ユーザーが見つかりません');
    }

    return user.passwordHash !== null;
  }

  /**
   * メールアドレス確認
   *
   * トークンを検証し、ユーザーの emailVerified を true に更新する。
   * resetPassword() と同パターン。
   */
  async verifyEmail(token: string): Promise<void> {
    const tokenHash = hashToken(token);

    // トークンを検索
    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: { tokenHash },
      include: { user: true },
    });

    // トークンの有効性を検証（情報漏洩防止のため統一エラーメッセージ）
    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestError('メールアドレス確認トークンが無効です');
    }

    // トランザクションで実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // トークンを使用済みにする
      await tx.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      });

      // emailVerified を true に更新
      await tx.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      });
    });

    logger.info({ userId: verificationToken.userId }, 'メールアドレス確認完了');
  }

  /**
   * メールアドレス確認メール再送信
   *
   * セキュリティ対策:
   * - ユーザーが存在しない場合もエラーを投げない（メール存在確認防止）
   * - 確認済み/OAuthのみの場合もエラーを投げない
   */
  async resendVerification(email: string): Promise<string | null> {
    const user = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });

    // ユーザーが存在しない、確認済み、またはOAuthのみユーザーの場合はnullを返す
    if (!user || user.emailVerified || !user.passwordHash) {
      return null;
    }

    // 確認トークン生成
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // トランザクションで既存トークン無効化と新規トークン作成をアトミックに実行
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 同一ユーザーの既存未使用トークンを無効化
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // 新しいトークンをDBに保存
      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS),
        },
      });
    });

    logger.info({ userId: user.id, email }, 'メールアドレス確認トークン再生成');

    return rawToken;
  }
}
