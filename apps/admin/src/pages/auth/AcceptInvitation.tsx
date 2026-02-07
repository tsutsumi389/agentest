import { useState, useEffect, type FormEvent } from 'react';
import { useParams, Link } from 'react-router';
import {
  Terminal,
  Lock,
  Loader2,
  AlertCircle,
  CheckCircle,
  User,
  Shield,
  Calendar,
  Eye,
  EyeOff,
} from 'lucide-react';
import { invitationApi, ApiError } from '../../lib/api';
import type { AdminInvitationResponse } from '@agentest/shared/types';

/**
 * ロール名を日本語ラベルに変換
 */
function getRoleLabel(role: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '最高権限管理者';
    case 'ADMIN':
      return '一般管理者';
    case 'VIEWER':
      return '閲覧専用';
    default:
      return role;
  }
}

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
 * 招待受諾ページ
 * 招待されたユーザーがパスワードを設定してアカウントを有効化する
 */
export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();

  // 状態
  const [invitation, setInvitation] = useState<AdminInvitationResponse | null>(null);
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true);
  const [invitationError, setInvitationError] = useState<string | null>(null);

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
    allRequirementsMet(requirements) &&
    passwordsMatch &&
    password.length > 0 &&
    confirmPassword.length > 0;

  // 招待情報を取得
  useEffect(() => {
    const fetchInvitation = async () => {
      if (!token) {
        setInvitationError('招待トークンが指定されていません');
        setIsLoadingInvitation(false);
        return;
      }

      try {
        const data = await invitationApi.getInvitation(token);
        setInvitation(data);
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === 'INVITATION_EXPIRED') {
            setInvitationError('この招待は有効期限が切れています。管理者に再度招待を依頼してください。');
          } else if (err.code === 'INVITATION_ALREADY_ACCEPTED') {
            setInvitationError('この招待は既に受諾されています。ログインページからログインしてください。');
          } else {
            setInvitationError(err.message);
          }
        } else {
          setInvitationError('招待情報の取得に失敗しました');
        }
      } finally {
        setIsLoadingInvitation(false);
      }
    };

    fetchInvitation();
  }, [token]);

  // フォーム送信
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!canSubmit || !token) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await invitationApi.acceptInvitation(token, { password });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVITATION_EXPIRED') {
          setSubmitError('この招待は有効期限が切れています。管理者に再度招待を依頼してください。');
        } else if (err.code === 'INVITATION_ALREADY_ACCEPTED') {
          setSubmitError('この招待は既に受諾されています。');
        } else if (err.details?.password) {
          setSubmitError(err.details.password[0]);
        } else {
          setSubmitError(err.message);
        }
      } else {
        setSubmitError('アカウントの有効化に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
                アカウントが有効化されました
              </h1>
              <p className="text-foreground-muted mb-6">
                パスワードの設定が完了しました。<br />
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

  // 読み込み中
  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <p className="text-foreground-muted">招待情報を確認中...</p>
        </div>
      </div>
    );
  }

  // エラー画面
  if (invitationError || !invitation) {
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

          {/* エラーメッセージ */}
          <div className="card p-6">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-danger-muted flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-danger" />
              </div>
              <h1 className="text-xl font-semibold text-foreground mb-2">
                招待を確認できません
              </h1>
              <p className="text-foreground-muted mb-6">
                {invitationError || '招待情報が見つかりません'}
              </p>
              <Link
                to="/login"
                className="btn btn-secondary w-full"
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

  // フォーム表示
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
          <p className="text-foreground-muted text-sm">管理者アカウントの設定</p>
        </div>

        {/* 招待情報カード */}
        <div className="card p-6 mb-4">
          <h2 className="text-sm font-medium text-foreground-muted mb-3">
            招待情報
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-foreground-subtle" />
              <div>
                <p className="text-sm text-foreground-muted">名前</p>
                <p className="text-foreground font-medium">{invitation.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-foreground-subtle" />
              <div>
                <p className="text-sm text-foreground-muted">ロール</p>
                <p className="text-foreground font-medium">
                  {getRoleLabel(invitation.role)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-foreground-subtle" />
              <div>
                <p className="text-sm text-foreground-muted">有効期限</p>
                <p className="text-foreground font-medium">
                  {new Date(invitation.expiresAt).toLocaleString('ja-JP', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <p className="text-xs text-foreground-subtle mt-2">
              {invitation.invitedBy} さんから招待されました
            </p>
          </div>
        </div>

        {/* パスワード設定フォーム */}
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground mb-4">
            パスワードを設定
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* CLI風の装飾 */}
            <div className="font-mono text-sm text-foreground-muted mb-4">
              <span className="text-accent">$</span> admin --setup --account
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
                  設定中...
                </>
              ) : (
                'アカウントを有効化'
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
