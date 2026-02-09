import { Link, useSearchParams } from 'react-router';
import { AgentestLogo } from '../components/ui/AgentestLogo';
import { authApi } from '../lib/api';
import { useEffect, useState } from 'react';

/**
 * メールアドレス確認ページ
 * メール内のリンクからアクセスされ、トークンを検証する
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('確認トークンが見つかりません');
      return;
    }

    const verify = async () => {
      try {
        await authApi.verifyEmail(token);
        setStatus('success');
      } catch (err) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'メールアドレスの確認に失敗しました';
        setErrorMessage(message);
      }
    };

    verify();
  }, [token]);

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

        {/* カード */}
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground text-center mb-6">
            メールアドレスの確認
          </h1>

          {status === 'verifying' && (
            <div className="space-y-4" role="status" aria-live="polite">
              <p className="text-sm text-foreground-muted text-center">
                メールアドレスを確認しています...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="space-y-4">
              <p className="text-sm text-foreground text-center">
                メールアドレスが確認されました
              </p>
              <p className="text-sm text-foreground-muted text-center">
                アカウントが有効化されました。ログインしてご利用ください。
              </p>
              <Link
                to="/login"
                className="btn btn-primary w-full block text-center"
              >
                ログインする
              </Link>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4">
              <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2 text-center">
                {errorMessage}
              </div>
              <p className="text-sm text-foreground-muted text-center">
                リンクが無効または期限切れの可能性があります。新規登録から再度お試しください。
              </p>
              <div className="pt-4 border-t border-border text-center">
                <Link to="/login" className="text-sm text-accent hover:underline">
                  ログインに戻る
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <p className="text-xs text-foreground-subtle text-center mt-6">
          &copy; 2026 Agentest. All rights reserved.
        </p>
      </div>
    </div>
  );
}
