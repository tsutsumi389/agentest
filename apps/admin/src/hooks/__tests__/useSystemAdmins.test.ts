import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import {
  useSystemAdmins,
  useSystemAdmin,
  useInviteSystemAdmin,
  useUpdateSystemAdmin,
  useDeleteSystemAdmin,
  useUnlockSystemAdmin,
  useReset2FASystemAdmin,
} from '../useSystemAdmins';
import { createQueryWrapper } from '../../__tests__/test-utils';

vi.mock('../../lib/api', () => ({
  systemAdminApi: {
    list: vi.fn(),
    getById: vi.fn(),
    invite: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    unlock: vi.fn(),
    reset2FA: vi.fn(),
  },
}));

import { systemAdminApi } from '../../lib/api';
const mockApi = vi.mocked(systemAdminApi);

describe('useSystemAdmins hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useSystemAdmins', () => {
    it('システム管理者一覧を取得する', async () => {
      const mockResponse = { admins: [], pagination: { total: 0 } };
      mockApi.list.mockResolvedValue(mockResponse as never);

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSystemAdmins(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(mockApi.list).toHaveBeenCalledWith({});
    });
  });

  describe('useSystemAdmin', () => {
    it('システム管理者詳細を取得する', async () => {
      const mockResponse = { admin: { id: 'admin-1', name: 'テスト' } };
      mockApi.getById.mockResolvedValue(mockResponse as never);

      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSystemAdmin('admin-1'), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
    });

    it('adminUserIdが空文字の場合はクエリを実行しない', () => {
      const { wrapper } = createQueryWrapper();
      const { result } = renderHook(() => useSystemAdmin(''), { wrapper });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockApi.getById).not.toHaveBeenCalled();
    });
  });

  describe('useInviteSystemAdmin', () => {
    it('招待を実行してキャッシュを無効化する', async () => {
      const mockResponse = { admin: { id: 'new-admin' } };
      mockApi.invite.mockResolvedValue(mockResponse as never);

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useInviteSystemAdmin(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          email: 'new@example.com',
          name: '新規管理者',
          role: 'ADMIN' as never,
        });
      });

      expect(mockApi.invite).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admins'] });
    });
  });

  describe('useUpdateSystemAdmin', () => {
    it('更新を実行してキャッシュを無効化する', async () => {
      mockApi.update.mockResolvedValue({ admin: { id: 'admin-1' } } as never);

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSystemAdmin(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          adminUserId: 'admin-1',
          data: { role: 'VIEWER' as never },
        });
      });

      expect(mockApi.update).toHaveBeenCalledWith('admin-1', { role: 'VIEWER' });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admins'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admin', 'admin-1'] });
    });
  });

  describe('useDeleteSystemAdmin', () => {
    it('削除を実行してキャッシュを無効化する', async () => {
      mockApi.delete.mockResolvedValue({ message: 'OK' } as never);

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteSystemAdmin(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('admin-1');
      });

      expect(mockApi.delete).toHaveBeenCalledWith('admin-1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admins'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admin', 'admin-1'] });
    });
  });

  describe('useUnlockSystemAdmin', () => {
    it('ロック解除を実行してキャッシュを無効化する', async () => {
      mockApi.unlock.mockResolvedValue({ message: 'OK' } as never);

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUnlockSystemAdmin(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('admin-1');
      });

      expect(mockApi.unlock).toHaveBeenCalledWith('admin-1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admins'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admin', 'admin-1'] });
    });
  });

  describe('useReset2FASystemAdmin', () => {
    it('2FAリセットを実行してキャッシュを無効化する', async () => {
      mockApi.reset2FA.mockResolvedValue({ message: 'OK' } as never);

      const { wrapper, queryClient } = createQueryWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useReset2FASystemAdmin(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('admin-1');
      });

      expect(mockApi.reset2FA).toHaveBeenCalledWith('admin-1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['system-admin', 'admin-1'] });
    });
  });
});
