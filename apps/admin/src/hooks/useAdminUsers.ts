import { useQuery } from '@tanstack/react-query';
import type { AdminUserSearchParams } from '@agentest/shared';
import { adminUsersApi } from '../lib/api';

/**
 * 管理者ユーザー一覧を取得するフック
 */
export function useAdminUsers(params: AdminUserSearchParams = {}) {
  return useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => adminUsersApi.list(params),
    staleTime: 60 * 1000, // 1分間はキャッシュを使用
  });
}
