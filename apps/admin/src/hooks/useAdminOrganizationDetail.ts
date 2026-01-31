import { useQuery } from '@tanstack/react-query';
import { adminOrganizationsApi } from '../lib/api';

/**
 * 管理者組織詳細を取得するフック
 */
export function useAdminOrganizationDetail(organizationId: string) {
  return useQuery({
    queryKey: ['admin-organization-detail', organizationId],
    queryFn: () => adminOrganizationsApi.getById(organizationId),
    staleTime: 30 * 1000, // 30秒間はキャッシュを使用
    enabled: !!organizationId,
  });
}
