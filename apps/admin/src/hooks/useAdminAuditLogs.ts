import { useQuery } from '@tanstack/react-query';
import type { AdminAuditLogSearchParams } from '@agentest/shared';
import { adminAuditLogsApi } from '../lib/api';

/**
 * 管理者監査ログ一覧を取得するフック
 */
export function useAdminAuditLogs(params: AdminAuditLogSearchParams = {}) {
  return useQuery({
    queryKey: ['admin-audit-logs', params],
    queryFn: () => adminAuditLogsApi.list(params),
    staleTime: 30 * 1000, // 30秒間はキャッシュを使用
  });
}
