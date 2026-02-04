import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminPlanDistribution } from '../useAdminPlanDistribution';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  adminMetricsApi: {
    getPlanDistribution: vi.fn(),
  },
}));

import { adminMetricsApi } from '../../lib/api';
const mockApi = vi.mocked(adminMetricsApi);

describe('useAdminPlanDistribution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('プラン分布メトリクスを取得する', async () => {
    const mockResponse = { distribution: [] };
    mockApi.getPlanDistribution.mockResolvedValue(mockResponse as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminPlanDistribution(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApi.getPlanDistribution).toHaveBeenCalledWith({});
  });

  it('パラメータ付きで取得する', async () => {
    const params = { view: 'percentage' as const, includeMembers: true };
    mockApi.getPlanDistribution.mockResolvedValue({ distribution: [] } as never);

    const { wrapper } = createQueryWrapper();
    renderHook(() => useAdminPlanDistribution(params), { wrapper });

    await waitFor(() => expect(mockApi.getPlanDistribution).toHaveBeenCalledWith(params));
  });
});
