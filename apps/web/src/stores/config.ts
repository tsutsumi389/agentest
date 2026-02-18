import { create } from 'zustand';
import { configApi } from '../lib/api';

interface ConfigState {
  auth: {
    providers: {
      github: boolean;
      google: boolean;
    };
    requireEmailVerification: boolean;
  };
  isLoaded: boolean;

  // アクション
  fetchConfig: () => Promise<void>;
  isOAuthEnabled: () => boolean;
}

/**
 * アプリケーション公開設定ストア
 * 起動時に1回fetchし、以降はキャッシュから参照
 */
export const useConfigStore = create<ConfigState>((set, get) => ({
  auth: {
    providers: { github: false, google: false },
    requireEmailVerification: true,
  },
  isLoaded: false,

  fetchConfig: async () => {
    // 既にロード済みなら再取得しない
    if (get().isLoaded) return;

    try {
      const config = await configApi.get();
      set({
        auth: config.auth,
        isLoaded: true,
      });
    } catch {
      // 取得失敗時はデフォルト値のまま、isLoadedだけtrueにする
      set({ isLoaded: true });
    }
  },

  isOAuthEnabled: () => {
    const { providers } = get().auth;
    return providers.github || providers.google;
  },
}));
