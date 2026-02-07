import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminMetrics } from '../useAdminMetrics';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  adminMetricsApi: {
    getActiveUsers: vi.fn(),
  },
}));

import { adminMetricsApi } from '../../lib/api';
const mockApi = vi.mocked(adminMetricsApi);

describe('useAdminMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('アクティブユーザーメトリクスを取得する', async () => {
    const mockResponse = { metrics: [] };
    mockApi.getActiveUsers.mockResolvedValue(mockResponse as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminMetrics(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApi.getActiveUsers).toHaveBeenCalledWith({});
  });

  it('パラメータ付きで取得する', async () => {
    const params = { granularity: 'day' as const, startDate: '2024-01-01' };
    mockApi.getActiveUsers.mockResolvedValue({ metrics: [] } as never);

    const { wrapper } = createQueryWrapper();
    renderHook(() => useAdminMetrics(params), { wrapper });

    await waitFor(() => expect(mockApi.getActiveUsers).toHaveBeenCalledWith(params));
  });
});
