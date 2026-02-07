import { NotFoundError, AuthorizationError } from '@agentest/shared';
import { SessionRepository, type CreateSessionData } from '../repositories/session.repository.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'session' });

/**
 * セッション情報（レスポンス用）
 */
export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  expiresAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

/**
 * セッション管理サービス
 */
export class SessionService {
  private sessionRepo = new SessionRepository();

  /**
   * 新しいセッションを作成
   */
  async createSession(data: CreateSessionData) {
    return this.sessionRepo.create(data);
  }

  /**
   * トークンでセッションを取得
   */
  async getSessionByToken(token: string) {
    const session = await this.sessionRepo.findByToken(token);
    if (!session) {
      return null;
    }

    // 失効済みまたは期限切れの場合はnullを返す
    if (session.revokedAt || session.expiresAt < new Date()) {
      return null;
    }

    return session;
  }

  /**
   * ユーザーのセッション一覧を取得
   */
  async getUserSessions(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    const sessions = await this.sessionRepo.findActiveByUserId(userId);

    return sessions.map((session) => ({
      ...session,
      isCurrent: session.id === currentSessionId,
    }));
  }

  /**
   * セッションの最終活動時刻を更新
   */
  async updateSessionActivity(sessionId: string) {
    try {
      await this.sessionRepo.updateLastActiveAt(sessionId);
    } catch (error) {
      // セッションが存在しない場合は警告ログを出力
      logger.warn({
        err: error instanceof Error ? error : undefined,
        sessionId,
      }, 'セッション活動時刻の更新に失敗');
    }
  }

  /**
   * 特定のセッションを強制終了
   *
   * ビジネスルール:
   * - 自分のセッションのみ終了可能
   */
  async revokeSession(userId: string, sessionId: string) {
    const session = await this.sessionRepo.findById(sessionId);

    if (!session) {
      throw new NotFoundError('Session', sessionId);
    }

    // 他ユーザーのセッションは終了不可
    if (session.userId !== userId) {
      throw new AuthorizationError('他のユーザーのセッションは終了できません');
    }

    // 既に失効済みの場合
    if (session.revokedAt) {
      throw new NotFoundError('Session', sessionId);
    }

    await this.sessionRepo.revoke(sessionId);

    return { success: true };
  }

  /**
   * 現在のセッション以外を全て終了
   */
  async revokeOtherSessions(userId: string, currentSessionId: string) {
    const result = await this.sessionRepo.revokeAllExcept(userId, currentSessionId);

    return {
      success: true,
      revokedCount: result.count,
    };
  }

  /**
   * ユーザーの全セッションを終了
   */
  async revokeAllSessions(userId: string) {
    const result = await this.sessionRepo.revokeAllByUserId(userId);

    return {
      success: true,
      revokedCount: result.count,
    };
  }

  /**
   * 有効なセッション数を取得
   */
  async getActiveSessionCount(userId: string): Promise<number> {
    return this.sessionRepo.countActiveByUserId(userId);
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  async cleanupExpiredSessions() {
    const result = await this.sessionRepo.deleteExpired();
    return { deletedCount: result.count };
  }
}
