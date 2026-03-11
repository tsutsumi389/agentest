import { useAdminAuthStore } from '../stores/admin-auth.store';

/**
 * 管理者認証フック
 * コンポーネントから認証状態とアクションにアクセスするためのフック
 */
export function useAdminAuth() {
  const admin = useAdminAuthStore((state) => state.admin);
  const isAuthenticated = useAdminAuthStore((state) => state.isAuthenticated);
  const isLoading = useAdminAuthStore((state) => state.isLoading);
  const requires2FA = useAdminAuthStore((state) => state.requires2FA);
  const error = useAdminAuthStore((state) => state.error);

  const initialize = useAdminAuthStore((state) => state.initialize);
  const login = useAdminAuthStore((state) => state.login);
  const verify2FA = useAdminAuthStore((state) => state.verify2FA);
  const logout = useAdminAuthStore((state) => state.logout);
  const updateAdmin = useAdminAuthStore((state) => state.updateAdmin);
  const clearError = useAdminAuthStore((state) => state.clearError);

  return {
    // 状態
    admin,
    isAuthenticated,
    isLoading,
    requires2FA,
    error,

    // アクション
    initialize,
    login,
    verify2FA,
    logout,
    updateAdmin,
    clearError,
  };
}
