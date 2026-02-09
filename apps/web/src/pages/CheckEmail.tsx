import { Link, useSearchParams } from 'react-router';
import { AgentestLogo } from '../components/ui/AgentestLogo';
import { authApi } from '../lib/api';
import { useState } from 'react';

/**
 * メール確認待ちページ
 * 新規登録後またはログイン時のメール未確認エラー後に表示
 */
export function CheckEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResent, setIsResent] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setError('');
    setIsSubmitting(true);

    try {
      await authApi.resendVerification({ email });
      setIsResent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '再送信に失敗しました';
      setError(message);
    } finally {
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

        {/* カード */}
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground text-center mb-6">
            メールアドレスの確認
          </h1>

          <div className="space-y-4">
            <p className="text-sm text-foreground text-center">
              確認メールを送信しました
            </p>
            {email && (
              <p className="text-sm text-foreground-muted text-center">
                <span className="font-medium text-foreground">{email}</span> の受信トレイを確認してください。
              </p>
            )}
            <p className="text-sm text-foreground-muted text-center">
              メール内のリンクをクリックしてアカウントを有効化してください。
            </p>

            {error && (
              <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            {isResent && (
              <div className="text-sm text-success bg-success/10 border border-success/20 rounded-md px-3 py-2 text-center">
                確認メールを再送信しました
              </div>
            )}

            {email && (
              <button
                type="button"
                onClick={handleResend}
                disabled={isSubmitting}
                className="btn btn-secondary w-full"
              >
                {isSubmitting ? '送信中...' : '確認メールを再送信'}
              </button>
            )}

            <div className="pt-4 border-t border-border text-center">
              <Link to="/login" className="text-sm text-accent hover:underline">
                ログインに戻る
              </Link>
            </div>
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
