import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { LoadingScreen } from '../ui/LoadingScreen';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useSetupStatus } from '../../hooks/useSetupStatus';

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * 認証ガードコンポーネント
 * セットアップ未完了の場合はセットアップページにリダイレクト
 * 未認証の場合はログインページにリダイレクト
 * 2FA検証が必要な場合は2FAページにリダイレクト
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, requires2FA } = useAdminAuth();
  const { setupCheckDone, isSetupRequired } = useSetupStatus();

  // 読み込み中（認証状態 or セットアップ状態）
  if (isLoading || !setupCheckDone) {
    return <LoadingScreen />;
  }

  // セットアップ未完了の場合
  if (isSetupRequired) {
    return <Navigate to="/setup" replace />;
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
