import { useQuery } from '@tanstack/react-query';
import { adminUsersApi } from '../lib/api';

/**
 * 管理者ユーザー詳細を取得するフック
 */
export function useAdminUserDetail(userId: string) {
  return useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => adminUsersApi.getById(userId),
    staleTime: 30 * 1000, // 30秒間はキャッシュを使用
    enabled: !!userId,
  });
}
