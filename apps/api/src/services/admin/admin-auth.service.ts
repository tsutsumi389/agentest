import bcrypt from 'bcrypt';
import { AuthenticationError } from '@agentest/shared';
import { AdminUserRepository } from '../../repositories/admin-user.repository.js';
import { AdminSessionService } from './admin-session.service.js';
import { AdminAuditLogService } from './admin-audit-log.service.js';

// bcryptのコストファクター
const BCRYPT_ROUNDS = 12;
// 最大ログイン失敗回数
const MAX_FAILED_ATTEMPTS = 5;
// アカウントロック時間（30分）
const LOCK_DURATION_MS = 30 * 60 * 1000;

/**
 * ログイン入力
 */
export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * ログイン成功結果
 */
export interface LoginResult {
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
    totpEnabled: boolean;
  };
  session: {
    token: string;
    expiresAt: Date;
  };
}

/**
 * 管理者認証サービス
 *
 * ログイン、ログアウト、セッション延長を管理
 */
export class AdminAuthService {
  private userRepo = new AdminUserRepository();
  private sessionService = new AdminSessionService();
  private auditLogService = new AdminAuditLogService();

  /**
   * パスワードをハッシュ化
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
  }

  /**
   * ログイン処理
   *
   * セキュリティ対策:
   * - ユーザー不存在時もbcrypt実行でタイミング攻撃を防止
   * - 5回失敗でアカウントを30分ロック
   * - 全操作を監査ログに記録
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const { email, password, ipAddress, userAgent } = input;

    // ユーザー検索
    const user = await this.userRepo.findByEmailWithPassword(email);

    // タイミング攻撃対策: ユーザーが存在しなくてもbcrypt処理を実行
    if (!user) {
      // ダミーのハッシュと比較してタイミングを均一化
      await bcrypt.compare(password, '$2b$12$dummyhashfortimingattack');
      throw new AuthenticationError('メールアドレスまたはパスワードが正しくありません');
    }

    // アカウントロックチェック
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditLogService.log({
        adminUserId: user.id,
        action: 'LOGIN_BLOCKED_LOCKED',
        details: { reason: 'account_locked' },
        ipAddress,
        userAgent,
      });
      throw new AuthenticationError('アカウントがロックされています。しばらく経ってから再度お試しください');
    }

    // パスワード検証
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // 失敗回数をインクリメント
      const updated = await this.userRepo.incrementFailedAttempts(user.id);
      const failedAttempts = updated.failedAttempts;

      // 最大試行回数を超えた場合はロック
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
        await this.userRepo.lockAccount(user.id, lockedUntil);

        await this.auditLogService.log({
          adminUserId: user.id,
          action: 'ACCOUNT_LOCKED',
          details: { failedAttempts, lockedUntil: lockedUntil.toISOString() },
          ipAddress,
          userAgent,
        });
      }

      await this.auditLogService.log({
        adminUserId: user.id,
        action: 'LOGIN_FAILED',
        details: { reason: 'invalid_password', failedAttempts },
        ipAddress,
        userAgent,
      });

      throw new AuthenticationError('メールアドレスまたはパスワードが正しくありません');
    }

    // ログイン成功: 失敗回数をリセット
    await this.userRepo.resetFailedAttempts(user.id);

    // セッション作成
    const session = await this.sessionService.createSession({
      adminUserId: user.id,
      userAgent,
      ipAddress,
    });

    // 成功ログを記録
    await this.auditLogService.log({
      adminUserId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
    });

    return {
      admin: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        totpEnabled: user.totpEnabled,
      },
      session: {
        token: session.token,
        expiresAt: session.expiresAt,
      },
    };
  }

  /**
   * ログアウト処理
   */
  async logout(
    token: string,
    adminUserId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.sessionService.revokeSession(token);

    await this.auditLogService.log({
      adminUserId,
      action: 'LOGOUT',
      ipAddress,
      userAgent,
    });
  }

  /**
   * セッション延長処理
   */
  async refreshSession(
    _token: string,
    adminUserId: string,
    sessionId: string,
    createdAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<Date | null> {
    const newExpiresAt = await this.sessionService.refreshSession(
      sessionId,
      createdAt
    );

    if (newExpiresAt) {
      await this.auditLogService.log({
        adminUserId,
        action: 'SESSION_REFRESHED',
        details: { newExpiresAt: newExpiresAt.toISOString() },
        ipAddress,
        userAgent,
      });
    }

    return newExpiresAt;
  }
}
