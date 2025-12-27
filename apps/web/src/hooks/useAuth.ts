import { useAuthStore } from '../stores/auth';

/**
 * 認証フック
 * 認証状態を取得するためのシンプルなフック
 * 注意: 初期化はApp.tsxで1回だけ行われる
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, logout, error, clearError } = useAuthStore();

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    logout,
    clearError,
  };
}

/**
 * 認証が必要なフック
 * 認証されていない場合はnullを返す
 */
export function useRequireAuth() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return { user: null, isLoading: true };
  }

  if (!isAuthenticated || !user) {
    return { user: null, isLoading: false };
  }

  return { user, isLoading: false };
}
