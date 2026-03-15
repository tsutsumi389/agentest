import crypto from 'crypto';
import {
  AdminSessionRepository,
  type CreateAdminSessionData,
} from '../../repositories/admin-session.repository.js';
import { hashToken } from '../../utils/pkce.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'admin-session' });

// セッション有効期限（2時間）
const SESSION_EXPIRY_MS = 2 * 60 * 60 * 1000;
// セッション最大延長期限（8時間）
const SESSION_MAX_EXPIRY_MS = 8 * 60 * 60 * 1000;

/**
 * セッション作成用の入力型
 */
export interface CreateAdminSessionInput {
  adminUserId: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * セッション検証結果
 * DBにはハッシュしかないため、tokenフィールドは含まない
 */
export interface ValidatedAdminSession {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  adminUser: {
    id: string;
    email: string;
    name: string;
    role: string;
    totpEnabled: boolean;
  };
}

/**
 * 管理者セッションサービス
 *
 * セッションの作成、検証、更新、失効を管理
 */
export class AdminSessionService {
  private sessionRepo = new AdminSessionRepository();

  /**
   * セキュアなセッショントークンを生成
   */
  generateToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * 新しいセッションを作成
   * 生トークンをハッシュ化してDBに保存し、生トークンはレスポンスで返却
   */
  async createSession(input: CreateAdminSessionInput) {
    const token = this.generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

    const data: CreateAdminSessionData = {
      adminUserId: input.adminUserId,
      tokenHash,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt,
    };

    const session = await this.sessionRepo.create(data);

    // 明示的にフィールドを選択（tokenHashの漏洩を防ぐ）
    return {
      id: session.id,
      adminUserId: session.adminUserId,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      token, // 生トークンをレスポンスに含める（クッキーにセットするため）
    };
  }

  /**
   * トークンでセッションを検証
   * 生トークンをハッシュ化してからDB検索する
   *
   * @returns 有効なセッション情報、または無効な場合はnull
   */
  async validateSession(token: string): Promise<ValidatedAdminSession | null> {
    const tokenHash = hashToken(token);
    const session = await this.sessionRepo.findByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    // 失効済みチェック
    if (session.revokedAt) {
      return null;
    }

    // 期限切れチェック
    if (session.expiresAt < new Date()) {
      return null;
    }

    // 管理者ユーザーが削除済みの場合
    if (session.adminUser.deletedAt) {
      return null;
    }

    return {
      id: session.id,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      adminUser: {
        id: session.adminUser.id,
        email: session.adminUser.email,
        name: session.adminUser.name,
        role: session.adminUser.role,
        totpEnabled: session.adminUser.totpEnabled,
      },
    };
  }

  /**
   * セッションの有効期限を延長
   *
   * 最大延長期限（作成から8時間）を超えない範囲で延長する
   *
   * @returns 新しい有効期限、または延長不可の場合はnull
   */
  async refreshSession(sessionId: string, createdAt: Date): Promise<Date | null> {
    // 最大延長期限を計算
    const maxExpiryTime = createdAt.getTime() + SESSION_MAX_EXPIRY_MS;
    const now = Date.now();

    // 既に最大延長期限を超えている場合は延長不可
    if (now >= maxExpiryTime) {
      return null;
    }

    // 新しい有効期限を計算（2時間後、または最大延長期限のどちらか早い方）
    const newExpiryTime = Math.min(now + SESSION_EXPIRY_MS, maxExpiryTime);
    const newExpiresAt = new Date(newExpiryTime);

    await this.sessionRepo.extendExpiry(sessionId, newExpiresAt);

    return newExpiresAt;
  }

  /**
   * セッションを失効（ログアウト）
   * 生トークンをハッシュ化してからDB検索する
   */
  async revokeSession(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await this.sessionRepo.revokeByTokenHash(tokenHash);
  }

  /**
   * 指定セッション以外の全セッションを失効（パスワード変更時用）
   */
  async revokeAllSessionsExcept(adminUserId: string, excludeSessionId: string): Promise<void> {
    await this.sessionRepo.revokeAllByUserIdExcept(adminUserId, excludeSessionId);
  }

  /**
   * セッションの最終活動時刻を更新
   */
  async updateActivity(sessionId: string): Promise<void> {
    try {
      await this.sessionRepo.updateLastActiveAt(sessionId);
    } catch (error) {
      // セッションが存在しない場合は警告ログを出力
      logger.warn(
        {
          err: error instanceof Error ? error : undefined,
          sessionId,
        },
        '管理者セッション活動時刻の更新に失敗'
      );
    }
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  async cleanupExpiredSessions() {
    const result = await this.sessionRepo.deleteExpired();
    return { deletedCount: result.count };
  }
}
