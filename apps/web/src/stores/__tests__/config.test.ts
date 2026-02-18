import { describe, it, expect, beforeEach, vi } from 'vitest';

// APIモック
const { mockConfigApi } = vi.hoisted(() => {
  return {
    mockConfigApi: {
      get: vi.fn(),
    },
  };
});

vi.mock('../../lib/api', () => ({
  configApi: mockConfigApi,
}));

import { useConfigStore } from '../config';

describe('config store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // ストアをリセット
    useConfigStore.setState({
      auth: {
        providers: { github: false, google: false },
        requireEmailVerification: true,
      },
      isLoaded: false,
    });
  });

  describe('初期状態', () => {
    it('デフォルトではすべてのプロバイダーが無効', () => {
      const state = useConfigStore.getState();
      expect(state.auth.providers.github).toBe(false);
      expect(state.auth.providers.google).toBe(false);
    });

    it('デフォルトではisLoadedがfalse', () => {
      const state = useConfigStore.getState();
      expect(state.isLoaded).toBe(false);
    });
  });

  describe('fetchConfig', () => {
    it('APIから設定を取得してストアに保存する', async () => {
      mockConfigApi.get.mockResolvedValue({
        auth: {
          providers: { github: true, google: false },
          requireEmailVerification: true,
        },
      });

      await useConfigStore.getState().fetchConfig();

      const state = useConfigStore.getState();
      expect(state.auth.providers.github).toBe(true);
      expect(state.auth.providers.google).toBe(false);
      expect(state.isLoaded).toBe(true);
    });

    it('API取得失敗時もisLoadedをtrueにする（デフォルト値のまま）', async () => {
      mockConfigApi.get.mockRejectedValue(new Error('Network error'));

      await useConfigStore.getState().fetchConfig();

      const state = useConfigStore.getState();
      expect(state.auth.providers.github).toBe(false);
      expect(state.auth.providers.google).toBe(false);
      expect(state.isLoaded).toBe(true);
    });

    it('既にロード済みの場合はAPIを呼ばない', async () => {
      useConfigStore.setState({ isLoaded: true });

      await useConfigStore.getState().fetchConfig();

      expect(mockConfigApi.get).not.toHaveBeenCalled();
    });
  });

  describe('isOAuthEnabled', () => {
    it('いずれかのプロバイダーが有効ならtrueを返す', () => {
      useConfigStore.setState({
        auth: {
          providers: { github: true, google: false },
          requireEmailVerification: true,
        },
        isLoaded: true,
      });

      expect(useConfigStore.getState().isOAuthEnabled()).toBe(true);
    });

    it('すべてのプロバイダーが無効ならfalseを返す', () => {
      useConfigStore.setState({
        auth: {
          providers: { github: false, google: false },
          requireEmailVerification: true,
        },
        isLoaded: true,
      });

      expect(useConfigStore.getState().isOAuthEnabled()).toBe(false);
    });
  });
});
