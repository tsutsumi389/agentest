import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminUsers } from '../useAdminUsers';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  adminUsersApi: {
    list: vi.fn(),
  },
}));

import { adminUsersApi } from '../../lib/api';
const mockApi = vi.mocked(adminUsersApi);

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ユーザー一覧を取得する', async () => {
    const mockResponse = { users: [], pagination: { total: 0, page: 1, limit: 20 } };
    mockApi.list.mockResolvedValue(mockResponse as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminUsers(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApi.list).toHaveBeenCalledWith({});
  });

  it('検索パラメータ付きで取得する', async () => {
    const params = { q: 'テスト', page: 2 };
    mockApi.list.mockResolvedValue({ users: [], pagination: { total: 0 } } as never);

    const { wrapper } = createQueryWrapper();
    renderHook(() => useAdminUsers(params), { wrapper });

    await waitFor(() => expect(mockApi.list).toHaveBeenCalledWith(params));
  });
});
