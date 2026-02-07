import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '../auth';
import { createMockUser } from '../../__tests__/factories';

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
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('認証済みの場合はユーザー情報を設定する', async () => {
      const mockUser = createMockUser({ name: 'テスト' });
      mockAuthApi.me.mockResolvedValue({ user: mockUser });

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
        user: createMockUser(),
        isAuthenticated: true,
        isLoading: false,
      });
      mockAuthApi.logout.mockResolvedValue({ message: 'OK' });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(mockWsClient.disconnect).toHaveBeenCalled();
    });

    it('APIエラーでもローカル状態はクリアする', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
      });
      mockAuthApi.logout.mockRejectedValue(new Error('サーバーエラー'));

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        'ログアウトエラー:',
        expect.any(Error)
      );
    });
  });

  describe('setUser', () => {
    it('ユーザーを設定して認証状態にする', () => {
      const mockUser = createMockUser();
      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('ユーザー情報を更新する', async () => {
      useAuthStore.setState({
        user: createMockUser({ name: '旧名前' }),
        isAuthenticated: true,
      });
      const updatedUser = createMockUser({ name: '新名前' });
      mockUsersApi.update.mockResolvedValue({ user: updatedUser });

      await useAuthStore.getState().updateUser({ name: '新名前' });

      expect(useAuthStore.getState().user).toEqual(updatedUser);
    });

    it('ユーザーが存在しない場合はエラーを投げる', async () => {
      useAuthStore.setState({ user: null });

      await expect(
        useAuthStore.getState().updateUser({ name: '新名前' })
      ).rejects.toThrow('ユーザーが見つかりません');
    });

    it('API失敗時はエラーが伝播する', async () => {
      useAuthStore.setState({
        user: createMockUser({ name: '旧名前' }),
        isAuthenticated: true,
      });
      mockUsersApi.update.mockRejectedValue(new Error('サーバーエラー'));

      await expect(
        useAuthStore.getState().updateUser({ name: '新名前' })
      ).rejects.toThrow('サーバーエラー');

      // ユーザー情報は変更されない
      const user = useAuthStore.getState().user;
      expect(user).not.toBeNull();
      expect(user?.name).toBe('旧名前');
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
