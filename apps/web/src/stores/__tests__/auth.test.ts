import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../auth';

// APIとWebSocketをモック
vi.mock('../../lib/api', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
  },
  usersApi: {
    update: vi.fn(),
  },
}));

vi.mock('../../lib/ws', () => ({
  wsClient: {
    disconnect: vi.fn(),
  },
}));

import { authApi, usersApi } from '../../lib/api';
import { wsClient } from '../../lib/ws';
const mockAuthApi = vi.mocked(authApi);
const mockUsersApi = vi.mocked(usersApi);
const mockWsClient = vi.mocked(wsClient);

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('認証済みの場合はユーザー情報を設定する', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'テスト' };
      mockAuthApi.me.mockResolvedValue({ user: mockUser } as any);

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('未認証の場合は未認証状態にする', async () => {
      mockAuthApi.me.mockRejectedValue(new Error('Unauthorized'));

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('ログアウトして状態をクリアする', async () => {
      useAuthStore.setState({
        user: { id: 'user-1' } as any,
        isAuthenticated: true,
        isLoading: false,
      });
      mockAuthApi.logout.mockResolvedValue(undefined as any);

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(mockWsClient.disconnect).toHaveBeenCalled();
    });

    it('APIエラーでもローカル状態はクリアする', async () => {
      useAuthStore.setState({
        user: { id: 'user-1' } as any,
        isAuthenticated: true,
      });
      mockAuthApi.logout.mockRejectedValue(new Error('サーバーエラー'));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    it('ユーザーを設定して認証状態にする', () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' };
      useAuthStore.getState().setUser(mockUser as any);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('ユーザー情報を更新する', async () => {
      useAuthStore.setState({
        user: { id: 'user-1', name: '旧名前' } as any,
        isAuthenticated: true,
      });
      const updatedUser = { id: 'user-1', name: '新名前' };
      mockUsersApi.update.mockResolvedValue({ user: updatedUser } as any);

      await useAuthStore.getState().updateUser({ name: '新名前' } as any);

      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });

    it('ユーザーが存在しない場合はエラーを投げる', async () => {
      useAuthStore.setState({ user: null });

      await expect(
        useAuthStore.getState().updateUser({ name: '新名前' } as any)
      ).rejects.toThrow('ユーザーが見つかりません');
    });
  });

  describe('clearError', () => {
    it('エラーをクリアする', () => {
      useAuthStore.setState({ error: 'エラー' });
      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
