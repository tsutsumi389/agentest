import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAuthStore } from '../auth';
import { createMockUser } from '../../__tests__/factories';

// APIとWebSocketをモック
// テスト用のApiErrorクラス
const { MockApiError } = vi.hoisted(() => {
  class MockApiError extends Error {
    statusCode: number;
    code: string;
    constructor(statusCode: number, code: string, message: string) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
      this.code = code;
    }
  }
  return { MockApiError };
});

vi.mock('../../lib/api', () => ({
  authApi: {
    me: vi.fn(),
    logout: vi.fn(),
    verify2FA: vi.fn(),
  },
  usersApi: {
    update: vi.fn(),
  },
  ApiError: MockApiError,
}));

vi.mock('../../lib/ws', () => ({
  wsClient: {
    connect: vi.fn(),
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
      requires2FA: false,
      twoFactorToken: null,
    });
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('認証済みの場合はユーザー情報を設定しWebSocket接続する', async () => {
      const mockUser = createMockUser({ name: 'テスト' });
      mockAuthApi.me.mockResolvedValue({ user: mockUser });

      await useAuthStore.getState().initialize();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockWsClient.connect).toHaveBeenCalled();
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
      expect(console.error).toHaveBeenCalledWith('ログアウトエラー:', expect.any(Error));
    });
  });

  describe('setUser', () => {
    it('ユーザーを設定して認証状態にしWebSocket接続する', () => {
      const mockUser = createMockUser();
      useAuthStore.getState().setUser(mockUser);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(mockWsClient.connect).toHaveBeenCalled();
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

      await expect(useAuthStore.getState().updateUser({ name: '新名前' })).rejects.toThrow(
        'ユーザーが見つかりません'
      );
    });

    it('API失敗時はエラーが伝播する', async () => {
      useAuthStore.setState({
        user: createMockUser({ name: '旧名前' }),
        isAuthenticated: true,
      });
      mockUsersApi.update.mockRejectedValue(new Error('サーバーエラー'));

      await expect(useAuthStore.getState().updateUser({ name: '新名前' })).rejects.toThrow(
        'サーバーエラー'
      );

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

  describe('2FA状態管理', () => {
    it('初期状態でrequires2FAがfalse、twoFactorTokenがnull', () => {
      const state = useAuthStore.getState();
      expect(state.requires2FA).toBe(false);
      expect(state.twoFactorToken).toBeNull();
    });

    it('set2FARequired で2FA必要状態を設定できる', () => {
      useAuthStore.getState().set2FARequired('temp-token-123');

      const state = useAuthStore.getState();
      expect(state.requires2FA).toBe(true);
      expect(state.twoFactorToken).toBe('temp-token-123');
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('verify2FA 成功時にユーザー設定と2FA状態クリアしWebSocket接続する', async () => {
      const mockUser = createMockUser({ name: '2FAユーザー' });
      mockAuthApi.verify2FA.mockResolvedValue({ user: mockUser });

      useAuthStore.setState({
        requires2FA: true,
        twoFactorToken: 'temp-token-123',
      });

      await useAuthStore.getState().verify2FA('123456');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.requires2FA).toBe(false);
      expect(state.twoFactorToken).toBeNull();
      expect(mockAuthApi.verify2FA).toHaveBeenCalledWith('temp-token-123', '123456');
      expect(mockWsClient.connect).toHaveBeenCalled();
    });

    it('verify2FA でtwoFactorTokenがない場合はエラー', async () => {
      useAuthStore.setState({
        requires2FA: false,
        twoFactorToken: null,
      });

      await expect(useAuthStore.getState().verify2FA('123456')).rejects.toThrow(
        '2FAトークンがありません'
      );
    });

    it('verify2FA 認証エラー（401）時はトークンをクリア', async () => {
      mockAuthApi.verify2FA.mockRejectedValue(
        new MockApiError(401, 'AUTHENTICATION_ERROR', '2FAトークンが無効です')
      );

      useAuthStore.setState({
        requires2FA: true,
        twoFactorToken: 'temp-token-123',
      });

      await expect(useAuthStore.getState().verify2FA('000000')).rejects.toThrow(
        '2FAトークンが無効です'
      );

      const state = useAuthStore.getState();
      expect(state.requires2FA).toBe(true);
      // 認証エラーではトークンはクリアされる（バックエンドで消費済み）
      expect(state.twoFactorToken).toBeNull();
    });

    it('verify2FA ネットワークエラー時はトークンを保持（リトライ可能）', async () => {
      mockAuthApi.verify2FA.mockRejectedValue(new Error('Network Error'));

      useAuthStore.setState({
        requires2FA: true,
        twoFactorToken: 'temp-token-123',
      });

      await expect(useAuthStore.getState().verify2FA('000000')).rejects.toThrow('Network Error');

      const state = useAuthStore.getState();
      expect(state.requires2FA).toBe(true);
      // ネットワークエラーではトークンは保持される（リトライ可能）
      expect(state.twoFactorToken).toBe('temp-token-123');
    });

    it('ログアウト時に2FA状態もクリアされる', async () => {
      useAuthStore.setState({
        user: createMockUser(),
        isAuthenticated: true,
        requires2FA: true,
        twoFactorToken: 'temp-token',
      });
      mockAuthApi.logout.mockResolvedValue({ message: 'OK' });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.requires2FA).toBe(false);
      expect(state.twoFactorToken).toBeNull();
    });
  });
});
