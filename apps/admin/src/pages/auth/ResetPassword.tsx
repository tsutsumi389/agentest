import { useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router';
import { Terminal, Lock, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { checkPasswordRequirements, allPasswordRequirementsMet } from '@agentest/shared';
import { passwordResetApi, ApiError } from '../../lib/api';
import { PasswordRequirementsList } from '../../components/auth/PasswordRequirementsList';

/**
 * パスワードリセット実行ページ
 * リセットメールのリンクから遷移し、新しいパスワードを設定する
 */
export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // パスワード要件チェック
  const requirements = checkPasswordRequirements(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    allPasswordRequirementsMet(requirements) &&
    passwordsMatch &&
    password.length > 0 &&
    confirmPassword.length > 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !token) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await passwordResetApi.resetPassword(token, password);
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details?.password) {
          setError(err.details.password[0]);
        } else {
          setError(err.message);
        }
      } else {
        setError('パスワードのリセットに失敗しました。しばらく経ってから再度お試しください。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // トークンが無い場合
  if (!token) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Terminal className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <span className="text-2xl font-bold text-foreground">Agentest Admin</span>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-danger-muted flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-danger" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">無効なリンク</h1>
              <p className="text-foreground-muted mb-6">
                パスワードリセットのトークンが指定されていません。
              </p>
              <Link to="/forgot-password" className="btn btn-secondary w-full">
                パスワードリセットを再リクエスト
              </Link>
            </div>
          </div>
          <p className="text-xs text-foreground-subtle text-center mt-6">
            &copy; {new Date().getFullYear()} Agentest. All rights reserved.
          </p>
        </div>
      </div>
    );
  }

  // 成功画面
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Terminal className="w-6 h-6 text-accent" aria-hidden="true" />
              </div>
              <span className="text-2xl font-bold text-foreground">Agentest Admin</span>
            </div>
          </div>
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-success-muted flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-success" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                パスワードをリセットしました
              </h1>
              <p className="text-foreground-muted mb-6">新しいパスワードでログインしてください。</p>
              <Link to="/login" className="btn btn-primary w-full">
                ログインページへ
              </Link>
            </div>
          </div>
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
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Terminal className="w-6 h-6 text-accent" aria-hidden="true" />
            </div>
            <span className="text-2xl font-bold text-foreground">Agentest Admin</span>
          </div>
          <p className="text-foreground-muted text-sm">新しいパスワードを設定</p>
        </div>

        {/* フォーム */}
        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CLI風の装飾 */}
            <div className="font-mono text-sm text-foreground-muted mb-4">
              <span className="text-accent">$</span> admin --new-password --secure
            </div>

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

            {/* パスワード入力 */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground-muted">
                新しいパスワード
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-foreground-subtle" aria-hidden="true" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-subtle hover:text-foreground-muted"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Eye className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* パスワード要件 */}
            <PasswordRequirementsList requirements={requirements} />

            {/* パスワード確認入力 */}
            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-foreground-muted"
              >
                新しいパスワード（確認）
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-foreground-subtle" aria-hidden="true" />
                </div>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`input pl-10 pr-10 ${
                    confirmPassword && !passwordsMatch ? 'border-danger' : ''
                  }`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'パスワードを隠す' : 'パスワードを表示'}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-subtle hover:text-foreground-muted"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" aria-hidden="true" />
                  ) : (
                    <Eye className="w-5 h-5" aria-hidden="true" />
                  )}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-danger">パスワードが一致しません</p>
              )}
            </div>

            {/* 送信ボタン */}
            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={!canSubmit || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  リセット中...
                </>
              ) : (
                'パスワードをリセット'
              )}
            </button>
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
