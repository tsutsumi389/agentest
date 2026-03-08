import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Mail, Lock, Loader2, AlertCircle, AlertTriangle } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

/**
 * ログインフォームコンポーネント
 * Terminal/CLI風のミニマルなデザイン
 */
export function LoginForm() {
  const { login, error, isLoading, clearError } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!email || !password) {
      return;
    }

    try {
      await login(email, password);
    } catch {
      // エラーはストアで管理されるため、ここでは何もしない
    }
  };

  // エラーメッセージの取得
  const getErrorMessage = () => {
    if (!error) return null;

    if (error.isLocked) {
      return 'アカウントがロックされています。しばらく経ってから再度お試しください';
    }

    if (error.isRateLimited) {
      return 'リクエストが多すぎます。しばらく待ってから再試行してください';
    }

    // バリデーションエラー
    if (error.details) {
      const messages = Object.values(error.details).flat();
      return messages[0] || error.message;
    }

    return error.message;
  };

  const errorMessage = getErrorMessage();
  const isLockedError = error?.isLocked;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* CLI風の装飾 */}
      <div className="font-mono text-sm text-foreground-muted mb-4">
        <span className="text-accent">$</span> admin --login --secure
      </div>

      {/* エラーメッセージ */}
      {errorMessage && (
        <div
          role="alert"
          className={`flex items-start gap-3 p-3 rounded-md ${
            isLockedError
              ? 'bg-warning-muted text-warning'
              : 'bg-danger-muted text-danger'
          }`}
        >
          {isLockedError ? (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="text-sm">
            <p>{errorMessage}</p>
            {isLockedError && (
              <p className="mt-1 opacity-80">30分後に再度お試しください</p>
            )}
          </div>
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
            disabled={isLoading}
          />
        </div>
      </div>

      {/* パスワード入力 */}
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground-muted"
        >
          パスワード
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Lock className="w-5 h-5 text-foreground-subtle" aria-hidden="true" />
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pl-10"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      {/* ログインボタン */}
      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={isLoading || !email || !password}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ログイン中...
          </>
        ) : (
          'ログイン'
        )}
      </button>

      {/* パスワードリセットリンク */}
      <div className="text-center">
        <Link
          to="/forgot-password"
          className="text-sm text-foreground-muted hover:text-foreground transition-colors"
        >
          パスワードをお忘れですか？
        </Link>
      </div>
    </form>
  );
}
