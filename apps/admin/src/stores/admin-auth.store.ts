import { create } from 'zustand';
import { adminAuthApi, ApiError, type AdminUser } from '../lib/api';

/**
 * 管理者認証ストアの状態
 */
interface AdminAuthState {
  /** 管理者ユーザー情報 */
  admin: AdminUser | null;
  /** 認証済みかどうか */
  isAuthenticated: boolean;
  /** 読み込み中かどうか */
  isLoading: boolean;
  /** 2FA検証が必要かどうか */
  requires2FA: boolean;
  /** エラー */
  error: ApiError | null;

  // アクション
  /** 認証状態を初期化 */
  initialize: () => Promise<void>;
  /** ログイン */
  login: (email: string, password: string) => Promise<void>;
  /** 2FA検証 */
  verify2FA: (code: string) => Promise<void>;
  /** ログアウト */
  logout: () => Promise<void>;
  /** 管理者情報を更新 */
  updateAdmin: (admin: AdminUser) => void;
  /** エラーをクリア */
  clearError: () => void;
}

/**
 * 管理者認証ストア
 */
export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  admin: null,
  isAuthenticated: false,
  isLoading: true,
  requires2FA: false,
  error: null,

  /**
   * 認証状態を初期化
   * アプリ起動時に呼び出す
   */
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      const { admin } = await adminAuthApi.me();
      set({
        admin,
        isAuthenticated: true,
        isLoading: false,
        requires2FA: false,
      });
    } catch {
      // 認証エラーは正常な状態（未ログイン）
      set({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        requires2FA: false,
      });
    }
  },

  /**
   * ログイン
   */
  login: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      const response = await adminAuthApi.login(email, password);

      // 2FAが有効な場合
      if (response.admin.totpEnabled) {
        set({
          admin: response.admin,
          isAuthenticated: false,
          isLoading: false,
          requires2FA: true,
        });
        return;
      }

      // 2FAが無効な場合は直接認証完了
      set({
        admin: response.admin,
        isAuthenticated: true,
        isLoading: false,
        requires2FA: false,
      });
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError(500, 'UNKNOWN_ERROR', 'ログインに失敗しました');

      set({
        isLoading: false,
        error: apiError,
      });

      throw apiError;
    }
  },

  /**
   * 2FA検証
   */
  verify2FA: async (code: string) => {
    try {
      set({ isLoading: true, error: null });

      const { admin } = await adminAuthApi.verify2FA(code);

      set({
        admin,
        isAuthenticated: true,
        isLoading: false,
        requires2FA: false,
      });
    } catch (error) {
      const apiError = error instanceof ApiError
        ? error
        : new ApiError(500, 'UNKNOWN_ERROR', '認証コードの検証に失敗しました');

      set({
        isLoading: false,
        error: apiError,
      });

      throw apiError;
    }
  },

  /**
   * ログアウト
   */
  logout: async () => {
    try {
      await adminAuthApi.logout();
    } catch {
      // エラーが発生してもローカル状態はクリア（ログアウト失敗は無視）
    } finally {
      set({
        admin: null,
        isAuthenticated: false,
        requires2FA: false,
        error: null,
      });
    }
  },

  /**
   * 管理者情報を更新（プロフィール変更後にストアを同期）
   */
  updateAdmin: (admin: AdminUser) => {
    set({ admin });
  },

  /**
   * エラーをクリア
   */
  clearError: () => {
    set({ error: null });
  },
}));
