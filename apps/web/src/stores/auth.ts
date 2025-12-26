import { create } from 'zustand';
import { authApi, usersApi, type User, type UpdateUserRequest } from '../lib/api';
import { wsClient } from '../lib/ws';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // アクション
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  updateUser: (data: UpdateUserRequest) => Promise<void>;
  clearError: () => void;
}

/**
 * 認証ストア
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  /**
   * 認証状態を初期化
   */
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      const { user } = await authApi.me();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      // WebSocket接続（トークンはクッキーにあるので空文字で接続試行）
      // 実際にはクッキーからトークンを取得する必要がある
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  /**
   * ログアウト
   */
  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // エラーでもローカル状態はクリア
      console.error('ログアウトエラー:', error);
    } finally {
      wsClient.disconnect();
      set({
        user: null,
        isAuthenticated: false,
        error: null,
      });
    }
  },

  /**
   * ユーザーを設定
   */
  setUser: (user: User) => {
    set({
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  /**
   * ユーザー情報を更新
   */
  updateUser: async (data: UpdateUserRequest) => {
    const currentUser = get().user;
    if (!currentUser) {
      throw new Error('ユーザーが見つかりません');
    }

    const response = await usersApi.update(currentUser.id, data);
    set({ user: response.data });
  },

  /**
   * エラーをクリア
   */
  clearError: () => {
    set({ error: null });
  },
}));
