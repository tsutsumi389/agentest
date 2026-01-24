import { useQuery } from '@tanstack/react-query';
import { adminDashboardApi } from '../lib/api';

/**
 * 管理者ダッシュボード統計を取得するフック
 */
export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminDashboardApi.getStats(),
    staleTime: 5 * 60 * 1000, // 5分間はキャッシュを使用
    refetchInterval: 5 * 60 * 1000, // 5分ごとに自動更新
  });
}
