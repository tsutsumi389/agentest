import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * 認証ガードコンポーネント
 * 未認証の場合はログインページにリダイレクト
 * 2FA検証が必要な場合は2FAページにリダイレクト
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, requires2FA } = useAdminAuth();

  // 読み込み中
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground-muted">読み込み中...</div>
      </div>
    );
  }

  // 2FA検証が必要な場合
  if (requires2FA) {
    return <Navigate to="/2fa" replace />;
  }

  // 未認証の場合
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 認証済みの場合
  return <>{children}</>;
}
