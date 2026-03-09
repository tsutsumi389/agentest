import { api } from './client.js';
import type {
  Session,
  RevokeSessionsResult,
  Account,
} from './types.js';

// ============================================
// セッションAPI
// ============================================

export const sessionsApi = {
  // セッション一覧を取得
  list: () => api.get<{ data: Session[] }>('/api/sessions'),
  // セッション数を取得
  count: () => api.get<{ data: { count: number } }>('/api/sessions/count'),
  // 特定のセッションを終了
  revoke: (sessionId: string) =>
    api.delete<{ data: { success: boolean } }>(`/api/sessions/${sessionId}`),
  // 他の全セッションを終了
  revokeOthers: () => api.delete<{ data: RevokeSessionsResult }>('/api/sessions'),
};

// ============================================
// OAuth連携アカウントAPI
// ============================================

export const accountsApi = {
  // 連携一覧を取得
  list: (userId: string) => api.get<{ data: Account[] }>(`/api/users/${userId}/accounts`),
  // 連携を解除
  unlink: (userId: string, provider: string) =>
    api.delete<{ data: { success: boolean } }>(`/api/users/${userId}/accounts/${provider}`),
  // OAuth連携開始URL（フロントエンドでリダイレクト用）
  getLinkUrl: (provider: 'github' | 'google') => {
    // window.location.href でリダイレクトするため、APIサーバーのフルURLが必要
    const apiUrl = import.meta.env.VITE_API_URL || '';
    return `${apiUrl}/api/auth/${provider}/link`;
  },
};

// ============================================
// パスワード管理API
// ============================================

export const passwordApi = {
  // パスワード設定状況を取得
  getStatus: (userId: string) =>
    api.get<{ hasPassword: boolean }>(`/api/users/${userId}/password/status`),

  // パスワードを初回設定
  setPassword: (userId: string, data: { password: string }) =>
    api.post<{ message: string }>(`/api/users/${userId}/password`, data),

  // パスワードを変更
  changePassword: (
    userId: string,
    data: { currentPassword: string; newPassword: string },
  ) => api.put<{ message: string }>(`/api/users/${userId}/password`, data),
};
