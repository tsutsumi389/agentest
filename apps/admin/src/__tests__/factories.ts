import type { AdminUser, AdminRole } from '../lib/api';

/**
 * モック管理者ユーザーを生成
 */
export function createMockAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'テスト管理者',
    role: 'ADMIN' as AdminRole,
    totpEnabled: false,
    ...overrides,
  };
}
