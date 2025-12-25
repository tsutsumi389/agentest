import { useEffect } from 'react';
import { useAuthStore } from '../stores/auth';

/**
 * 認証フック
 * コンポーネントマウント時に認証状態を初期化
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, initialize, logout, error, clearError } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

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
