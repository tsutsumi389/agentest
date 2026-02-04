import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminUserDetail } from '../useAdminUserDetail';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  adminUsersApi: {
    getById: vi.fn(),
  },
}));

import { adminUsersApi } from '../../lib/api';
const mockApi = vi.mocked(adminUsersApi);

describe('useAdminUserDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ユーザー詳細を取得する', async () => {
    const mockResponse = { user: { id: 'user-1', name: 'テスト' } };
    mockApi.getById.mockResolvedValue(mockResponse as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminUserDetail('user-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApi.getById).toHaveBeenCalledWith('user-1');
  });

  it('userIdが空文字の場合はクエリを実行しない', () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminUserDetail(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.getById).not.toHaveBeenCalled();
  });
});
