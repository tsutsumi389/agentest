import { Navigate } from 'react-router';
import { Github, Chrome, FlaskConical } from 'lucide-react';
import { useAuthStore } from '../stores/auth';

/**
 * ログインページ
 */
export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuthStore();

  // 既にログイン済みの場合はダッシュボードにリダイレクト
  if (isAuthenticated && !isLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';

  const handleGitHubLogin = () => {
    window.location.href = `${apiUrl}/api/auth/github`;
  };

  const handleGoogleLogin = () => {
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FlaskConical className="w-10 h-10 text-accent" />
            <span className="text-2xl font-bold text-foreground">Agentest</span>
          </div>
          <p className="text-foreground-muted text-sm">
            AI連携テスト管理ツール
          </p>
        </div>

        {/* ログインカード */}
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground text-center mb-6">
            ログイン
          </h1>

          <div className="space-y-3">
            <button
              onClick={handleGitHubLogin}
              className="btn btn-secondary w-full"
            >
              <Github className="w-5 h-5" />
              GitHubでログイン
            </button>

            <button
              onClick={handleGoogleLogin}
              className="btn btn-secondary w-full"
            >
              <Chrome className="w-5 h-5" />
              Googleでログイン
            </button>
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-foreground-subtle text-center">
              ログインすることで、
              <a href="#" className="text-accent hover:underline">利用規約</a>
              および
              <a href="#" className="text-accent hover:underline">プライバシーポリシー</a>
              に同意したものとみなされます。
            </p>
          </div>
        </div>

        {/* フッター */}
        <p className="text-xs text-foreground-subtle text-center mt-6">
          &copy; 2024 Agentest. All rights reserved.
        </p>
      </div>
    </div>
  );
}
