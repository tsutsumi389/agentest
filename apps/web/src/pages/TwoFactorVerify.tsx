import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { Shield } from 'lucide-react';
import { AgentestLogo } from '../components/ui/AgentestLogo';
import { useAuthStore } from '../stores/auth';

/**
 * 2FA検証ページ
 * ログイン時に2FAが有効なユーザーのTOTPコード入力画面
 */
export function TwoFactorVerifyPage() {
  const { isAuthenticated, requires2FA, twoFactorToken, verify2FA } = useAuthStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo = searchParams.get('redirect');

  // 既に認証済みの場合はダッシュボードにリダイレクト
  if (isAuthenticated) {
    return <Navigate to={redirectTo || '/dashboard'} replace />;
  }

  // 2FAトークンがない場合はログインページにリダイレクト
  if (!requires2FA || !twoFactorToken) {
    return <Navigate to="/login" replace />;
  }

  // 数字のみ、最大6桁に制限
  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await verify2FA(code);
      navigate(redirectTo || '/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '認証に失敗しました';
      setError(message);
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
        </div>

        {/* 2FA検証カード */}
        <div className="card p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full bg-accent-subtle flex items-center justify-center mb-3">
              <Shield className="w-6 h-6 text-accent" />
            </div>
            <h1 className="text-lg font-semibold text-foreground">二要素認証</h1>
            <p className="text-sm text-foreground-muted text-center mt-1">
              認証アプリに表示されている6桁のコードを入力してください
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="totp-code" className="block text-sm font-medium text-foreground mb-1">
                認証コード
              </label>
              <input
                id="totp-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                className="input w-full text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || code.length !== 6}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? '認証中...' : '認証する'}
            </button>
          </form>

          {/* ログインに戻るリンク */}
          <div className="mt-6 pt-4 border-t border-border">
            <p className="text-sm text-foreground-muted text-center">
              <Link to="/login" className="text-accent hover:underline">
                ログインに戻る
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
