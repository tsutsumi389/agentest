import { Navigate } from 'react-router';
import { Terminal } from 'lucide-react';
import { LoginForm } from '../../components/auth/LoginForm';
import { LoadingScreen } from '../../components/ui/LoadingScreen';
import { useAdminAuth } from '../../hooks/useAdminAuth';

/**
 * ログインページ
 * Terminal/CLI風のミニマルなダークテーマ
 */
export function LoginPage() {
  const { isAuthenticated, isLoading, requires2FA } = useAdminAuth();

  // 読み込み中
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 2FA検証が必要な場合
  if (requires2FA) {
    return <Navigate to="/2fa" replace />;
  }

  // 既にログイン済みの場合
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Terminal className="w-6 h-6 text-accent" />
            </div>
            <span className="text-2xl font-bold text-foreground">
              Agentest Admin
            </span>
          </div>
          <p className="text-foreground-muted text-sm">管理コンソール</p>
        </div>

        {/* ログインカード */}
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground text-center mb-6">
            管理者ログイン
          </h1>

          <LoginForm />
        </div>

        {/* フッター */}
        <p className="text-xs text-foreground-subtle text-center mt-6">
          &copy; 2026 Agentest. All rights reserved.
        </p>
      </div>
    </div>
  );
}
