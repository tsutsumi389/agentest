import { api } from './client.js';
import type { AgentSessionListResponse, SessionSource } from './types.js';

// ============================================
// MCPセッションAPI
// ============================================

export const agentSessionsApi = {
  // セッション一覧を取得
  list: (params?: { status?: string; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.page !== undefined) query.set('page', String(params.page));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const queryString = query.toString();
    return api.get<AgentSessionListResponse>(
      `/api/agent-sessions${queryString ? `?${queryString}` : ''}`
    );
  },
  // セッションを終了
  end: (sessionId: string, source?: SessionSource) =>
    api.delete<{ data: { success: boolean } }>(
      `/api/agent-sessions/${sessionId}${source ? `?source=${source}` : ''}`
    ),
};
