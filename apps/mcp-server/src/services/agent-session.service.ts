import type { AgentSession } from '@agentest/db';
import { NotFoundError } from '@agentest/shared';
import {
  agentSessionRepository,
  type CreateAgentSessionData,
} from '../repositories/agent-session.repository.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'agent-session' });

/**
 * セッション管理の設定
 */
export const SESSION_CONFIG = {
  // ハートビート間隔（秒）- クライアントがハートビートを送信する推奨間隔
  HEARTBEAT_INTERVAL: 30,
  // ハートビートタイムアウト（秒）- ハートビート途絶後にTIMEOUTとする時間
  HEARTBEAT_TIMEOUT: 60,
} as const;

/**
 * セッション取得または作成の結果
 */
export interface GetOrCreateSessionResult {
  session: AgentSession;
  isNew: boolean;
}

/**
 * AgentSessionサービス
 * セッション管理のビジネスロジックを提供
 */
export const agentSessionService = {
  /**
   * 新しいセッションを作成
   */
  async createSession(data: CreateAgentSessionData): Promise<AgentSession> {
    return agentSessionRepository.create(data);
  },

  /**
   * セッションを取得（存在しない場合は作成）
   */
  async getOrCreateSession(data: CreateAgentSessionData): Promise<GetOrCreateSessionResult> {
    // 既存のアクティブなセッションを検索
    const existingSession = await agentSessionRepository.findActiveByProjectAndClient(
      data.projectId,
      data.clientId
    );

    if (existingSession) {
      // ハートビートを更新して返す
      const updatedSession = await agentSessionRepository.updateHeartbeat(existingSession.id);
      return { session: updatedSession, isNew: false };
    }

    // 新しいセッションを作成
    const newSession = await agentSessionRepository.create(data);
    return { session: newSession, isNew: true };
  },

  /**
   * IDでセッションを取得
   */
  async getSessionById(id: string): Promise<AgentSession> {
    const session = await agentSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundError('AgentSession', id);
    }
    return session;
  },

  /**
   * セッションが有効かチェック
   */
  isSessionValid(session: AgentSession): boolean {
    // ステータスがACTIVEでなければ無効
    if (session.status !== 'ACTIVE') {
      return false;
    }

    // ハートビートタイムアウトをチェック
    const now = Date.now();
    const lastHeartbeat = session.lastHeartbeat.getTime();
    const elapsedSeconds = (now - lastHeartbeat) / 1000;

    return elapsedSeconds < SESSION_CONFIG.HEARTBEAT_TIMEOUT;
  },

  /**
   * ハートビートを記録
   */
  async recordHeartbeat(sessionId: string): Promise<AgentSession> {
    return agentSessionRepository.updateHeartbeat(sessionId);
  },

  /**
   * セッションを終了
   */
  async endSession(sessionId: string): Promise<AgentSession> {
    return agentSessionRepository.endSession(sessionId);
  },

  /**
   * プロジェクトのアクティブなセッションを取得
   */
  async getActiveSessionsByProject(projectId: string): Promise<AgentSession[]> {
    return agentSessionRepository.findActiveByProject(projectId);
  },

  /**
   * タイムアウトしたセッションを処理
   * @returns タイムアウトしたセッション数
   */
  async processTimedOutSessions(): Promise<number> {
    const timedOutSessions = await agentSessionRepository.findTimedOutSessions(
      SESSION_CONFIG.HEARTBEAT_TIMEOUT
    );

    if (timedOutSessions.length === 0) {
      return 0;
    }

    const ids = timedOutSessions.map((s) => s.id);
    const count = await agentSessionRepository.markAsTimedOut(ids);

    logger.info({ count }, 'セッションがタイムアウトしました');
    return count;
  },
};
