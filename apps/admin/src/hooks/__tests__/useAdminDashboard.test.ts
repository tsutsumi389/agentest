import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminDashboard } from '../useAdminDashboard';
import { createQueryWrapper } from '../../__tests__/test-utils';

// APIをモック
vi.mock('../../lib/api', () => ({
  adminDashboardApi: {
    getStats: vi.fn(),
  },
}));

import { adminDashboardApi } from '../../lib/api';
const mockApi = vi.mocked(adminDashboardApi);

describe('useAdminDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ダッシュボード統計を取得する', async () => {
    const mockStats = {
      users: { total: 100, active: 80 },
      organizations: { total: 10 },
    };
    mockApi.getStats.mockResolvedValue(mockStats as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockStats);
    expect(mockApi.getStats).toHaveBeenCalledOnce();
  });

  it('エラー時にisErrorがtrueになる', async () => {
    mockApi.getStats.mockRejectedValue(new Error('サーバーエラー'));

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
