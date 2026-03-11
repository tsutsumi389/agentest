import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Github } from 'lucide-react';
import { AgentestLogo } from '../components/ui/AgentestLogo';
import { GoogleIcon } from '../components/ui/GoogleIcon';
import { useAuthStore } from '../stores/auth';
import { useConfigStore } from '../stores/config';
import { authApi, ApiError } from '../lib/api';
import { useState } from 'react';
import { getSafeRedirect } from '../lib/url';

/**
 * ログインページ
 */
export function LoginPage() {
  const { isAuthenticated, isLoading, setUser, set2FARequired } = useAuthStore();
  const { auth: { providers } } = useConfigStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const showGitHub = providers.github;
  const showGoogle = providers.google;
  const showOAuth = showGitHub || showGoogle;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // リダイレクト先を取得（認証後に戻る先、外部URLはブロック）
  const rawRedirect = searchParams.get('redirect');
  const redirectTo = getSafeRedirect(rawRedirect);

  // 既にログイン済みの場合はリダイレクト先またはダッシュボードにリダイレクト
  if (isAuthenticated && !isLoading) {
    return <Navigate to={redirectTo} replace />;
  }

  // リダイレクト先をsessionStorageに保存（OAuth認証後に使用）
  if (rawRedirect) {
    // 安全な内部パスのみ保存する
    sessionStorage.setItem('auth_redirect', redirectTo);
  }

  const apiUrl = import.meta.env.VITE_API_URL || '';

  const handleGitHubLogin = () => {
    window.location.href = `${apiUrl}/api/auth/github`;
  };

  const handleGoogleLogin = () => {
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await authApi.login({ email, password });

      // 2FA有効ユーザー: 2FA検証ページへ遷移
      if (response.requires2FA) {
        set2FARequired(response.twoFactorToken);
        // 安全な内部パスのみ2FA検証後のリダイレクト先として引き継ぐ
        const params = rawRedirect ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
        navigate(`/2fa/verify${params}`, { replace: true });
        return;
      }

      // 2FA無効ユーザー: 従来通りダッシュボードへ遷移
      setUser(response.user);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // メール未確認エラーの場合はメール確認ページへリダイレクト
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        navigate(`/check-email?email=${encodeURIComponent(email)}`, { replace: true });
        return;
      }
      const message = err instanceof Error ? err.message : 'ログインに失敗しました';
      setError(message);
      setPassword('');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <AgentestLogo className="w-10 h-10 text-accent" />
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

          {/* メール/パスワードフォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input w-full"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder="パスワードを入力"
                required
              />
            </div>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-accent hover:underline">
                パスワードをお忘れですか？
              </Link>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>

          {/* OAuthセクション（有効なプロバイダーがある場合のみ表示） */}
          {showOAuth && (
            <>
              {/* 区切り線 */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-bg-secondary text-foreground-muted">または</span>
                </div>
              </div>

              {/* OAuthボタン */}
              <div className="space-y-3">
                {showGitHub && (
                  <button
                    onClick={handleGitHubLogin}
                    className="btn btn-secondary w-full"
                  >
                    <Github className="w-5 h-5" />
                    GitHubでログイン
                  </button>
                )}

                {showGoogle && (
                  <button
                    onClick={handleGoogleLogin}
                    className="btn btn-secondary w-full"
                  >
                    <GoogleIcon className="w-5 h-5" />
                    Googleでログイン
                  </button>
                )}
              </div>
            </>
          )}

          {/* 新規登録リンク */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-foreground-muted text-center">
              アカウントをお持ちでない場合は{' '}
              <Link to="/register" className="text-accent hover:underline">
                新規登録
              </Link>
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
