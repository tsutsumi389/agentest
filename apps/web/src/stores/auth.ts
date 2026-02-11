import { create } from 'zustand';
import { authApi, ApiError, usersApi, type User, type UpdateUserRequest } from '../lib/api';
import { wsClient } from '../lib/ws';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // 2FA状態
  requires2FA: boolean;
  twoFactorToken: string | null;

  // アクション
  initialize: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  updateUser: (data: UpdateUserRequest) => Promise<void>;
  clearError: () => void;

  // 2FAアクション
  set2FARequired: (twoFactorToken: string) => void;
  verify2FA: (code: string) => Promise<void>;
}

/**
 * 認証ストア
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  requires2FA: false,
  twoFactorToken: null,

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
        requires2FA: false,
        twoFactorToken: null,
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
    set({ user: response.user });
  },

  /**
   * エラーをクリア
   */
  clearError: () => {
    set({ error: null });
  },

  /**
   * 2FA必要状態を設定（ログイン時にrequires2FAレスポンスを受けた場合）
   */
  set2FARequired: (twoFactorToken: string) => {
    set({
      requires2FA: true,
      twoFactorToken,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  /**
   * 2FA検証（TOTPコードで認証を完了する）
   *
   * 認証エラー（401）の場合はトークンをクリア（バックエンドで消費済み）。
   * ネットワークエラー等の場合はトークンを保持してリトライ可能にする。
   */
  verify2FA: async (code: string) => {
    const token = get().twoFactorToken;
    if (!token) {
      throw new Error('2FAトークンがありません');
    }

    try {
      const { user } = await authApi.verify2FA(token, code);
      set({
        user,
        isAuthenticated: true,
        requires2FA: false,
        twoFactorToken: null,
      });
    } catch (error) {
      // 認証エラー（トークン無効/期限切れ/コード不正）: トークンをクリア
      if (error instanceof ApiError && error.statusCode === 401) {
        set({ twoFactorToken: null });
      }
      // ネットワークエラーや5xxの場合はトークンを保持（リトライ可能）
      throw error;
    }
  },
}));
