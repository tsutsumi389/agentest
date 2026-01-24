import { useQuery } from '@tanstack/react-query';
import type { AdminOrganizationSearchParams } from '@agentest/shared';
import { adminOrganizationsApi } from '../lib/api';

/**
 * 管理者組織一覧を取得するフック
 */
export function useAdminOrganizations(params: AdminOrganizationSearchParams = {}) {
  return useQuery({
    queryKey: ['admin-organizations', params],
    queryFn: () => adminOrganizationsApi.list(params),
    staleTime: 60 * 1000, // 1分間はキャッシュを使用
  });
}
