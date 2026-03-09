import { api } from './client.js';
import type { AppConfig } from './types.js';

// ============================================
// 公開設定API
// ============================================

export const configApi = {
  get: () => api.get<AppConfig>('/api/config'),
};
