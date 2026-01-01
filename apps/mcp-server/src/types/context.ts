import type { AgentSession } from '@agentest/db';

/**
 * リクエストコンテキストの型定義
 * AsyncLocalStorageとToolContextで共有
 */
export interface RequestContext {
  /** MCPセッションID */
  sessionId: string;
  /** 認証済みユーザーID */
  userId: string;
  /** AgentSession情報（存在する場合） */
  agentSession?: AgentSession;
}
