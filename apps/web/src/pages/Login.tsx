import { Navigate, useSearchParams } from 'react-router';
import { Github, Chrome, FlaskConical } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useEffect } from 'react';

/**
 * リダイレクト先が外部オリジンかどうかを判定
 */
function isExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url, window.location.origin);
    return parsedUrl.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/**
 * ログインページ
 */
export function LoginPage() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const [searchParams] = useSearchParams();

  // リダイレクト先を取得（認証後に戻る先）
  const redirectTo = searchParams.get('redirect');

  // 既にログイン済みで外部オリジンへのリダイレクトが必要な場合
  useEffect(() => {
    if (isAuthenticated && !isLoading && redirectTo && isExternalUrl(redirectTo)) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, isLoading, redirectTo]);

  // 既にログイン済みの場合はリダイレクト先またはダッシュボードにリダイレクト
  if (isAuthenticated && !isLoading) {
    // 外部オリジンの場合はuseEffectで処理するので、ここではnullを返す
    if (redirectTo && isExternalUrl(redirectTo)) {
      return null;
    }
    return <Navigate to={redirectTo || '/dashboard'} replace />;
  }

  // リダイレクト先をsessionStorageに保存（OAuth認証後に使用）
  if (redirectTo) {
    sessionStorage.setItem('auth_redirect', redirectTo);
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
