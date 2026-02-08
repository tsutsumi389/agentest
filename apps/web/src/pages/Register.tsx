import { Link, useNavigate } from 'react-router';
import { Github } from 'lucide-react';
import { AgentestLogo } from '../components/ui/AgentestLogo';
import { GoogleIcon } from '../components/ui/GoogleIcon';
import { PasswordStrengthChecklist } from '../components/PasswordStrengthChecklist';
import { useAuthStore } from '../stores/auth';
import { authApi } from '../lib/api';
import { useState } from 'react';

/**
 * 新規登録ページ
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const apiUrl = import.meta.env.VITE_API_URL || '';

  const handleGitHubRegister = () => {
    window.location.href = `${apiUrl}/api/auth/github`;
  };

  const handleGoogleRegister = () => {
    window.location.href = `${apiUrl}/api/auth/google`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // パスワード一致チェック
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません');
      return;
    }

    setIsSubmitting(true);

    try {
      const { user } = await authApi.register({ email, password, name });
      setUser(user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : '登録に失敗しました';
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
          <p className="text-foreground-muted text-sm">
            AI連携テスト管理ツール
          </p>
        </div>

        {/* 登録カード */}
        <div className="card p-6">
          <h1 className="text-lg font-semibold text-foreground text-center mb-6">
            アカウント作成
          </h1>

          {/* メール/パスワードフォーム */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1">
                名前
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder="表示名"
                required
              />
            </div>

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

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1">
                パスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full"
                placeholder="パスワードを入力"
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
              {isSubmitting ? '作成中...' : 'アカウント作成'}
            </button>
          </form>

          {/* 区切り線 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-bg-secondary text-foreground-muted">または</span>
            </div>
          </div>

          {/* OAuthボタン */}
          <div className="space-y-3">
            <button
              onClick={handleGitHubRegister}
              className="btn btn-secondary w-full"
            >
              <Github className="w-5 h-5" />
              GitHubで登録
            </button>

            <button
              onClick={handleGoogleRegister}
              className="btn btn-secondary w-full"
            >
              <GoogleIcon className="w-5 h-5" />
              Googleで登録
            </button>
          </div>

          {/* ログインリンク */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-sm text-foreground-muted text-center">
              既にアカウントをお持ちの場合は{' '}
              <Link to="/login" className="text-accent hover:underline">
                ログイン
              </Link>
            </p>
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
