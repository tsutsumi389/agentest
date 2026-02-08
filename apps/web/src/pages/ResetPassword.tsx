import { Link, useSearchParams } from 'react-router';
import { AgentestLogo } from '../components/ui/AgentestLogo';
import { PasswordStrengthChecklist, PASSWORD_CHECKS } from '../components/PasswordStrengthChecklist';
import { authApi, ApiError } from '../lib/api';
import { useState } from 'react';

/**
 * パスワードリセット実行ページ
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('無効なリンクです');
      return;
    }

    // パスワード一致チェック
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません');
      return;
    }

    // パスワード強度チェック
    const allMet = PASSWORD_CHECKS.every((check) => check.test(password));
    if (!allMet) {
      setError('パスワードがすべての条件を満たしていません');
      return;
    }

    setIsSubmitting(true);

    try {
      await authApi.resetPassword({ token, password });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'TOKEN_EXPIRED') {
        setIsTokenExpired(true);
      }
      const message = err instanceof Error ? err.message : 'パスワードの変更に失敗しました';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // トークンがない場合
  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-2">
              <AgentestLogo className="w-10 h-10 text-accent" />
              <span className="text-2xl font-bold text-foreground">Agentest</span>
            </div>
          </div>

          <div className="card p-6">
            <p className="text-sm text-error text-center">無効なリンクです</p>
            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-sm text-accent hover:underline">
                パスワードリセットを再リクエスト
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            新しいパスワードを設定
          </h1>

          {isSuccess ? (
            /* 成功画面 */
            <div className="space-y-4">
              <p className="text-sm text-foreground text-center">
                パスワードを変更しました
              </p>
              <div className="pt-4 border-t border-border text-center">
                <Link to="/login" className="text-sm text-accent hover:underline">
                  ログインする
                </Link>
              </div>
            </div>
          ) : (
            /* 入力フォーム */
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                  {error}
                  {isTokenExpired && (
                    <div className="mt-2">
                      <Link to="/forgot-password" className="text-accent hover:underline">
                        再送信する
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                  新しいパスワード
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input w-full"
                  placeholder="新しいパスワードを入力"
                  required
                />
                <div className="mt-2">
                  <PasswordStrengthChecklist password={password} />
                </div>
              </div>

              <div>
                <label htmlFor="password-confirm" className="block text-sm font-medium text-foreground mb-1">
                  パスワード（確認）
                </label>
                <input
                  id="password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  className="input w-full"
                  placeholder="パスワードを再入力"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary w-full"
              >
                {isSubmitting ? '変更中...' : 'パスワードを変更'}
              </button>
            </form>
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
