import { useQuery } from '@tanstack/react-query';
import { adminMetricsApi, type AdminMetricsParams } from '../lib/api';

/**
 * アクティブユーザーメトリクスを取得するフック
 */
export function useAdminMetrics(params: AdminMetricsParams = {}) {
  return useQuery({
    queryKey: ['admin-metrics', 'active-users', params],
    queryFn: () => adminMetricsApi.getActiveUsers(params),
    staleTime: 1 * 60 * 1000, // 1分間はキャッシュを使用
    refetchInterval: 1 * 60 * 1000, // 1分ごとに自動更新
  });
}
