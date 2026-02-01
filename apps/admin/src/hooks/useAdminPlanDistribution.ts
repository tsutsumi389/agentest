import { useQuery } from '@tanstack/react-query';
import { adminMetricsApi, type PlanDistributionParams } from '../lib/api';

/**
 * プラン分布メトリクスを取得するフック
 */
export function useAdminPlanDistribution(params: PlanDistributionParams = {}) {
  return useQuery({
    queryKey: ['admin-metrics', 'plan-distribution', params],
    queryFn: () => adminMetricsApi.getPlanDistribution(params),
    staleTime: 1 * 60 * 1000, // 1分間はキャッシュを使用
    refetchInterval: 1 * 60 * 1000, // 1分ごとに自動更新
  });
}
