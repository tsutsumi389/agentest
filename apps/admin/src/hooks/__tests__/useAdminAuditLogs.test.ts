import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminAuditLogs } from '../useAdminAuditLogs';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  adminAuditLogsApi: {
    list: vi.fn(),
  },
}));

import { adminAuditLogsApi } from '../../lib/api';
const mockApi = vi.mocked(adminAuditLogsApi);

describe('useAdminAuditLogs', () => {
  it('監査ログ一覧を取得する', async () => {
    const mockResponse = { auditLogs: [], pagination: { total: 0 } };
    mockApi.list.mockResolvedValue(mockResponse as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminAuditLogs(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApi.list).toHaveBeenCalledWith({});
  });

  it('検索パラメータ付きで取得する', async () => {
    const params = { category: ['AUTH' as const], userId: 'user-1' };
    mockApi.list.mockResolvedValue({ auditLogs: [] } as never);

    const { wrapper } = createQueryWrapper();
    renderHook(() => useAdminAuditLogs(params), { wrapper });

    await waitFor(() => expect(mockApi.list).toHaveBeenCalledWith(params));
  });
});
