import { api } from './client.js';
import type { ApiToken, CreatedApiToken, CreateApiTokenRequest } from './types.js';

// ============================================
// APIトークンAPI
// ============================================

export const apiTokensApi = {
  // トークン一覧を取得
  list: () => api.get<{ tokens: ApiToken[] }>('/api/api-tokens'),

  // トークンを作成
  create: (data: CreateApiTokenRequest) =>
    api.post<{ token: CreatedApiToken }>('/api/api-tokens', data),

  // トークンを失効
  revoke: (tokenId: string) => api.delete<{ success: boolean }>(`/api/api-tokens/${tokenId}`),
};
