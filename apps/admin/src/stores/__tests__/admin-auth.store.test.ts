import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAdminAuthStore } from '../admin-auth.store';
import { createMockAdminUser } from '../../__tests__/factories';

// APIをモック（ApiErrorは実際のクラスを使用し、APIメソッドのみモック）
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    adminAuthApi: {
      me: vi.fn(),
      login: vi.fn(),
      verify2FA: vi.fn(),
      logout: vi.fn(),
    },
  };
});

import { adminAuthApi, ApiError } from '../../lib/api';
const mockAuthApi = vi.mocked(adminAuthApi);

describe('admin-auth store', () => {
  beforeEach(() => {
    useAdminAuthStore.setState({
      admin: null,
      isAuthenticated: false,
      isLoading: true,
      requires2FA: false,
      error: null,
    });
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('認証済みの場合は管理者情報を設定する', async () => {
      const mockAdmin = createMockAdminUser({ name: 'テスト管理者' });
      mockAuthApi.me.mockResolvedValue({ admin: mockAdmin });

      await useAdminAuthStore.getState().initialize();

      const state = useAdminAuthStore.getState();
      expect(state.admin).toEqual(mockAdmin);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.requires2FA).toBe(false);
    });

    it('未認証の場合は未認証状態にする', async () => {
      mockAuthApi.me.mockRejectedValue(new Error('Unauthorized'));

      await useAdminAuthStore.getState().initialize();

      const state = useAdminAuthStore.getState();
      expect(state.admin).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.requires2FA).toBe(false);
    });

    it('初期化中はisLoadingをtrueに設定しerrorをクリアする', async () => {
      // エラー状態から初期化を開始
      useAdminAuthStore.setState({
        error: new ApiError(500, 'ERROR', 'テスト'),
        isLoading: false,
      });

      const mockAdmin = createMockAdminUser();
      mockAuthApi.me.mockResolvedValue({ admin: mockAdmin });

      await useAdminAuthStore.getState().initialize();

      // 初期化完了後の状態を確認
      const state = useAdminAuthStore.getState();
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('login', () => {
    it('2FAが無効な場合は直接認証完了する', async () => {
      const mockAdmin = createMockAdminUser({ totpEnabled: false });
      mockAuthApi.login.mockResolvedValue({ admin: mockAdmin, expiresAt: '2024-01-15T13:00:00Z' });

      await useAdminAuthStore.getState().login('admin@example.com', 'password');

      const state = useAdminAuthStore.getState();
      expect(state.admin).toEqual(mockAdmin);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.requires2FA).toBe(false);
    });

    it('2FAが有効な場合はrequires2FAをtrueにする', async () => {
      const mockAdmin = createMockAdminUser({ totpEnabled: true });
      mockAuthApi.login.mockResolvedValue({ admin: mockAdmin, expiresAt: '2024-01-15T13:00:00Z' });

      await useAdminAuthStore.getState().login('admin@example.com', 'password');

      const state = useAdminAuthStore.getState();
      expect(state.admin).toEqual(mockAdmin);
      expect(state.isAuthenticated).toBe(false);
      expect(state.requires2FA).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('ApiErrorの場合はエラーを設定してスローする', async () => {
      const apiError = new ApiError(401, 'INVALID_CREDENTIALS', '認証情報が無効です');
      mockAuthApi.login.mockRejectedValue(apiError);

      await expect(
        useAdminAuthStore.getState().login('admin@example.com', 'wrong')
      ).rejects.toThrow('認証情報が無効です');

      const state = useAdminAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).toEqual(apiError);
    });

    it('不明なエラーの場合はApiErrorに変換してスローする', async () => {
      mockAuthApi.login.mockRejectedValue(new Error('ネットワークエラー'));

      await expect(
        useAdminAuthStore.getState().login('admin@example.com', 'password')
      ).rejects.toThrow('ログインに失敗しました');

      const state = useAdminAuthStore.getState();
      expect(state.isLoading).toBe(false);
      expect(state.error).not.toBeNull();
      expect(state.error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('verify2FA', () => {
    it('2FA検証成功で認証完了する', async () => {
      const mockAdmin = createMockAdminUser();
      mockAuthApi.verify2FA.mockResolvedValue({ admin: mockAdmin });

      await useAdminAuthStore.getState().verify2FA('123456');

      const state = useAdminAuthStore.getState();
      expect(state.admin).toEqual(mockAdmin);
      expect(state.isAuthenticated).toBe(true);
      expect(state.requires2FA).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('ApiErrorの場合はエラーを設定してスローする', async () => {
      const apiError = new ApiError(401, 'INVALID_CODE', '無効な認証コードです');
      mockAuthApi.verify2FA.mockRejectedValue(apiError);

      await expect(
        useAdminAuthStore.getState().verify2FA('000000')
      ).rejects.toThrow('無効な認証コードです');

      expect(useAdminAuthStore.getState().error).toEqual(apiError);
    });

    it('不明なエラーの場合はApiErrorに変換してスローする', async () => {
      mockAuthApi.verify2FA.mockRejectedValue(new Error('ネットワークエラー'));

      await expect(
        useAdminAuthStore.getState().verify2FA('123456')
      ).rejects.toThrow('認証コードの検証に失敗しました');

      expect(useAdminAuthStore.getState().error?.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('logout', () => {
    it('ログアウトして状態をクリアする', async () => {
      useAdminAuthStore.setState({
        admin: createMockAdminUser(),
        isAuthenticated: true,
        isLoading: false,
      });
      mockAuthApi.logout.mockResolvedValue({ message: 'OK' });

      await useAdminAuthStore.getState().logout();

      const state = useAdminAuthStore.getState();
      expect(state.admin).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.requires2FA).toBe(false);
      expect(state.error).toBeNull();
    });

    it('APIエラーでもローカル状態はクリアする', async () => {
      useAdminAuthStore.setState({
        admin: createMockAdminUser(),
        isAuthenticated: true,
      });
      mockAuthApi.logout.mockRejectedValue(new Error('サーバーエラー'));

      await useAdminAuthStore.getState().logout();

      expect(useAdminAuthStore.getState().admin).toBeNull();
      expect(useAdminAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('clearError', () => {
    it('エラーをクリアする', () => {
      useAdminAuthStore.setState({
        error: new ApiError(400, 'BAD_REQUEST', 'テストエラー'),
      });

      useAdminAuthStore.getState().clearError();

      expect(useAdminAuthStore.getState().error).toBeNull();
    });
  });
});
