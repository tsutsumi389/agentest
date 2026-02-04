import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAdminOrganizationDetail } from '../useAdminOrganizationDetail';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  adminOrganizationsApi: {
    getById: vi.fn(),
  },
}));

import { adminOrganizationsApi } from '../../lib/api';
const mockApi = vi.mocked(adminOrganizationsApi);

describe('useAdminOrganizationDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('組織詳細を取得する', async () => {
    const mockResponse = { organization: { id: 'org-1', name: 'テスト組織' } };
    mockApi.getById.mockResolvedValue(mockResponse as never);

    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminOrganizationDetail('org-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockResponse);
    expect(mockApi.getById).toHaveBeenCalledWith('org-1');
  });

  it('organizationIdが空文字の場合はクエリを実行しない', () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useAdminOrganizationDetail(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockApi.getById).not.toHaveBeenCalled();
  });
});
