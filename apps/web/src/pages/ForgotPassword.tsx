import { Link } from 'react-router';
import { AgentestLogo } from '../components/ui/AgentestLogo';
import { authApi } from '../lib/api';
import { useState } from 'react';

/**
 * パスワードリセット要求ページ
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await authApi.forgotPassword({ email });
      setIsSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '送信に失敗しました';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      await authApi.forgotPassword({ email });
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
            パスワードリセット
          </h1>

          {isSent ? (
            /* 送信完了画面 */
            <div className="space-y-4">
              <p className="text-sm text-foreground text-center">メールを送信しました</p>
              <p className="text-sm text-foreground-muted text-center">
                受信トレイを確認してください。
              </p>

              {error && (
                <div
                  role="alert"
                  className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2"
                >
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleResend}
                disabled={isSubmitting}
                className="btn btn-secondary w-full"
              >
                {isSubmitting ? '送信中...' : '再送信'}
              </button>

              <div className="pt-4 border-t border-border text-center">
                <Link to="/login" className="text-sm text-accent hover:underline">
                  ログインに戻る
                </Link>
              </div>
            </div>
          ) : (
            /* 入力フォーム */
            <div className="space-y-4">
              <p className="text-sm text-foreground-muted">
                登録されたメールアドレスにリセットリンクを送信します。
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2"
                  >
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

                <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full">
                  {isSubmitting ? '送信中...' : 'リセットリンクを送信'}
                </button>
              </form>

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
