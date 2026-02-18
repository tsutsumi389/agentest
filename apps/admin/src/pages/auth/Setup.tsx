import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import {
  Terminal,
  Lock,
  Mail,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { setupApi, ApiError } from '../../lib/api';

/**
 * パスワード要件のチェック結果
 */
interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
}

/**
 * パスワード要件をチェック
 */
function checkPasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  };
}

/**
 * すべての要件を満たしているかチェック
 */
function allRequirementsMet(requirements: PasswordRequirements): boolean {
  return Object.values(requirements).every(Boolean);
}

/**
 * 初回セットアップページ
 * AdminUserが0件の場合にSUPER_ADMINアカウントを作成する
 */
export function SetupPage() {
  const navigate = useNavigate();

  // セットアップ状態の確認
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);

  // フォーム状態
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // パスワード要件チェック
  const requirements = checkPasswordRequirements(password);
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    allRequirementsMet(requirements) &&
    passwordsMatch &&
    password.length > 0 &&
    confirmPassword.length > 0;

  // セットアップ状態をチェック
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const { isSetupRequired } = await setupApi.getStatus();
        if (!isSetupRequired) {
          // セットアップ済みならログインページへ
          navigate('/login', { replace: true });
          return;
        }
        setIsSetupRequired(true);
      } catch {
        // APIエラーの場合もセットアップ画面を表示（APIが利用できない場合のフォールバック）
        setIsSetupRequired(true);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkStatus();
  }, [navigate]);

  // フォーム送信
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await setupApi.setup({ email, name: name.trim(), password });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 403) {
          setSubmitError('セットアップは既に完了しています。ログインページからログインしてください。');
        } else if (err.details) {
          // フィールドエラーの最初のメッセージを表示
          const firstError = Object.values(err.details).flat()[0];
          setSubmitError(firstError || err.message);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('セットアップに失敗しました。もう一度お試しください。');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 読み込み中
  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-foreground-muted">セットアップ状態を確認中...</p>
        </div>
      </div>
    );
  }

  // セットアップ不要（リダイレクト中）
  if (!isSetupRequired) {
    return null;
  }

  // 成功画面
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-sm">
          {/* ロゴ */}
          <div className="flex flex-col items-center mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
                <Terminal className="w-6 h-6 text-accent" />
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
                <CheckCircle className="w-8 h-8 text-success" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                セットアップが完了しました
              </h1>
              <p className="text-foreground-muted mb-6">
                管理者アカウントが作成されました。<br />
                ログインページからログインしてください。
              </p>
              <Link
                to="/login"
                className="btn btn-primary w-full"
              >
                ログインページへ
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

  // セットアップフォーム
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
              <Terminal className="w-6 h-6 text-accent" />
            </div>
            <span className="text-2xl font-bold text-foreground">
              Agentest Admin
            </span>
          </div>
          <p className="text-foreground-muted text-sm">初回セットアップ</p>
        </div>

        {/* セットアップフォーム */}
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground mb-2">
            管理者アカウントの作成
          </h1>
          <p className="text-sm text-foreground-muted mb-6">
            最高権限管理者（SUPER_ADMIN）アカウントを作成します。
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* CLI風の装飾 */}
            <div className="font-mono text-sm text-foreground-muted mb-4">
              <span className="text-accent">$</span> admin --init --create-super-admin
            </div>

            {/* エラーメッセージ */}
            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-3 p-3 rounded-md bg-danger-muted text-danger"
              >
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p className="text-sm">{submitError}</p>
              </div>
            )}

            {/* 名前入力 */}
            <div className="space-y-2">
              <label
                htmlFor="name"
                className="block text-sm font-medium text-foreground-muted"
              >
                名前
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-5 h-5 text-foreground-subtle" />
                </div>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input pl-10"
                  placeholder="管理者名"
                  autoComplete="name"
                  required
                  disabled={isSubmitting}
                  maxLength={100}
                />
              </div>
            </div>

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
                  <Mail className="w-5 h-5 text-foreground-subtle" />
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
                  maxLength={255}
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
                  <Lock className="w-5 h-5 text-foreground-subtle" />
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-subtle hover:text-foreground-muted"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* パスワード要件 */}
            <div className="space-y-2 p-3 bg-surface-secondary rounded-md">
              <p className="text-xs font-medium text-foreground-muted mb-2">
                パスワード要件:
              </p>
              <ul className="space-y-1 text-xs">
                <li
                  className={`flex items-center gap-2 ${
                    requirements.minLength ? 'text-success' : 'text-foreground-subtle'
                  }`}
                >
                  <span>{requirements.minLength ? '✓' : '○'}</span>
                  8文字以上
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    requirements.hasUppercase ? 'text-success' : 'text-foreground-subtle'
                  }`}
                >
                  <span>{requirements.hasUppercase ? '✓' : '○'}</span>
                  大文字を含む (A-Z)
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    requirements.hasLowercase ? 'text-success' : 'text-foreground-subtle'
                  }`}
                >
                  <span>{requirements.hasLowercase ? '✓' : '○'}</span>
                  小文字を含む (a-z)
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    requirements.hasNumber ? 'text-success' : 'text-foreground-subtle'
                  }`}
                >
                  <span>{requirements.hasNumber ? '✓' : '○'}</span>
                  数字を含む (0-9)
                </li>
                <li
                  className={`flex items-center gap-2 ${
                    requirements.hasSymbol ? 'text-success' : 'text-foreground-subtle'
                  }`}
                >
                  <span>{requirements.hasSymbol ? '✓' : '○'}</span>
                  記号を含む (!@#$%...)
                </li>
              </ul>
            </div>

            {/* パスワード確認入力 */}
            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-foreground-muted"
              >
                パスワード（確認）
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-5 h-5 text-foreground-subtle" />
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
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground-subtle hover:text-foreground-muted"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
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
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  セットアップ中...
                </>
              ) : (
                '管理者アカウントを作成'
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
