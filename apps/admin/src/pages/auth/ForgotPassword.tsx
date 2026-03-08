import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  Terminal,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import { passwordResetApi, ApiError } from '../../lib/api';

/**
 * パスワードリセット要求ページ
 * メールアドレスを入力してリセットメールを送信する
 */
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await passwordResetApi.requestReset(email);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.email) {
          setError(err.details.email[0]);
        } else {
          setError(err.message);
        }
      } else {
        setError('リクエストに失敗しました。しばらく経ってから再度お試しください。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 送信成功画面
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* ロゴ */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Terminal className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <span className="text-2xl font-bold text-foreground">
                Agentest Admin
              </span>
            </div>
          </div>

          {/* 成功メッセージ */}
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-success-muted flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-success" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                メールを送信しました
              </h1>
              <p className="text-foreground-muted mb-6">
                メールアドレスが登録されている場合、パスワードリセット用のメールを送信しました。
                受信トレイをご確認ください。
              </p>
              <p className="text-xs text-foreground-subtle mb-6">
                メールが届かない場合は、迷惑メールフォルダをご確認ください。
              </p>
              <Link
                to="/login"
                className="btn btn-secondary w-full"
              >
                ログインページへ戻る
              </Link>
            </div>
          </div>

          {/* フッター */}
          <p className="text-xs text-foreground-subtle text-center mt-6">
            &copy; {new Date().getFullYear()} Agentest. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  // フォーム表示
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Terminal className="w-6 h-6 text-accent" aria-hidden="true" />
            </div>
            <span className="text-2xl font-bold text-foreground">
              Agentest Admin
            </span>
          </div>
          <p className="text-foreground-muted text-sm">パスワードリセット</p>
        </div>

        {/* フォーム */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CLI風の装飾 */}
            <div className="font-mono text-sm text-foreground-muted mb-4">
              <span className="text-accent">$</span> admin --reset-password
            </div>

            <p className="text-sm text-foreground-muted">
              登録されたメールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
            </p>

            {/* エラーメッセージ */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 p-3 rounded-md bg-danger-muted text-danger"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* メールアドレス入力 */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground-muted"
              >
                メールアドレス
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-5 h-5 text-foreground-subtle" aria-hidden="true" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-10"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={isSubmitting || !email}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  送信中...
                </>
              ) : (
                'リセットメールを送信'
              )}
            </button>

            {/* ログインへ戻る */}
            <Link
              to="/login"
              className="flex items-center justify-center gap-2 text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              ログインページへ戻る
            </Link>
          </form>
        </div>

        {/* フッター */}
        <p className="text-xs text-foreground-subtle text-center mt-6">
          &copy; {new Date().getFullYear()} Agentest. All rights reserved.
        </p>
      </div>
    </div>
  );
}
