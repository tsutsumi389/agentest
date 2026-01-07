import { Navigate, useSearchParams } from 'react-router';
import { Github, FlaskConical } from 'lucide-react';

/**
 * GoogleアイコンのSVGコンポーネント
 */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
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
              <GoogleIcon className="w-5 h-5" />
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
          &copy; 2026 Agentest. All rights reserved.
        </p>
      </div>
    </div>
  );
}
