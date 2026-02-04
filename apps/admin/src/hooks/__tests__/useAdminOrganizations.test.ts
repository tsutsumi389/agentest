import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminOrganizations } from '../useAdminOrganizations';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  adminOrganizationsApi: {
    list: vi.fn(),
  },
}));

import { adminOrganizationsApi } from '../../lib/api';
const mockApi = vi.mocked(adminOrganizationsApi);

describe('useAdminOrganizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('組織一覧を取得する', async () => {
    const mockResponse = { organizations: [], pagination: { total: 0 } };
    mockApi.list.mockResolvedValue(mockResponse as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminOrganizations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApi.list).toHaveBeenCalledWith({});
  });

  it('検索パラメータ付きで取得する', async () => {
    const params = { q: 'テスト組織', status: 'active' };
    mockApi.list.mockResolvedValue({ organizations: [] } as never);

    const { wrapper } = createQueryWrapper();
    renderHook(() => useAdminOrganizations(params), { wrapper });

    await waitFor(() => expect(mockApi.list).toHaveBeenCalledWith(params));
  });
});
