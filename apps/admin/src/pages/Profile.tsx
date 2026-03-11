import { useState } from 'react';
import { Loader2, Check, AlertCircle, Shield, ShieldOff, QrCode } from 'lucide-react';
import { checkPasswordRequirements, allPasswordRequirementsMet } from '@agentest/shared/validators';
import { useAdminAuth } from '../hooks/useAdminAuth';
import {
  useUpdateProfile,
  useChangePassword,
  useSetup2FA,
  useEnable2FA,
  useDisable2FA,
} from '../hooks/useProfile';

/**
 * プロフィール編集ページ
 */
export function Profile() {
  const { admin } = useAdminAuth();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">プロフィール</h1>
          <p className="text-foreground-muted mt-1">アカウント情報の確認と編集</p>
        </div>

        <NameSection key={admin?.name ?? ''} currentName={admin?.name ?? ''} />
        <PasswordSection />
        <TwoFactorSection totpEnabled={admin?.totpEnabled ?? false} />
      </div>
    </div>
  );
}

// ============================================
// 基本情報セクション
// ============================================

function NameSection({ currentName }: { currentName: string }) {
  const [name, setName] = useState(currentName);
  const [success, setSuccess] = useState(false);
  const { mutate, isLoading, error } = useUpdateProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    try {
      await mutate(name);
      setSuccess(true);
      // 3秒後に成功メッセージを非表示
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // エラーはフックで管理
    }
  };

  return (
    <section className="bg-background-secondary border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">基本情報</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground-muted mb-1">
            表示名
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full max-w-md"
            maxLength={100}
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-success">
            <Check className="w-4 h-4 shrink-0" />
            <span>プロフィールを更新しました</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || name === currentName || name.trim() === ''}
          className="btn btn-primary"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          保存
        </button>
      </form>
    </section>
  );
}

// ============================================
// パスワード変更セクション
// ============================================

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const { mutate, isLoading, error } = useChangePassword();

  const passwordRequirements = checkPasswordRequirements(newPassword);
  const isPasswordStrong = allPasswordRequirementsMet(passwordRequirements);
  const passwordMismatch = confirmPassword !== '' && newPassword !== confirmPassword;
  const canSubmit = currentPassword !== '' && isPasswordStrong && confirmPassword === newPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    try {
      await mutate(currentPassword, newPassword);
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      // エラーはフックで管理
    }
  };

  return (
    <section className="bg-background-secondary border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">パスワード変更</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground-muted mb-1">
            現在のパスワード
          </label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input w-full max-w-md"
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-foreground-muted mb-1">
            新しいパスワード
          </label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input w-full max-w-md"
            autoComplete="new-password"
            required
          />
          {newPassword === '' ? (
            <p className="text-xs text-foreground-muted mt-1">
              8文字以上、大文字・小文字・数字・記号を含む
            </p>
          ) : (
            <ul className="text-xs mt-1 space-y-0.5">
              <li className={passwordRequirements.minLength ? 'text-success' : 'text-error'}>
                {passwordRequirements.minLength ? '✓' : '×'} 8文字以上
              </li>
              <li className={passwordRequirements.hasUppercase ? 'text-success' : 'text-error'}>
                {passwordRequirements.hasUppercase ? '✓' : '×'} 大文字を含む
              </li>
              <li className={passwordRequirements.hasLowercase ? 'text-success' : 'text-error'}>
                {passwordRequirements.hasLowercase ? '✓' : '×'} 小文字を含む
              </li>
              <li className={passwordRequirements.hasNumber ? 'text-success' : 'text-error'}>
                {passwordRequirements.hasNumber ? '✓' : '×'} 数字を含む
              </li>
              <li className={passwordRequirements.hasSymbol ? 'text-success' : 'text-error'}>
                {passwordRequirements.hasSymbol ? '✓' : '×'} 記号を含む
              </li>
            </ul>
          )}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground-muted mb-1">
            新しいパスワード（確認）
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input w-full max-w-md"
            autoComplete="new-password"
            required
          />
          {passwordMismatch && (
            <p className="text-xs text-error mt-1">パスワードが一致しません</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-success">
            <Check className="w-4 h-4 shrink-0" />
            <span>パスワードを変更しました</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !canSubmit}
          className="btn btn-primary"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          パスワードを変更
        </button>
      </form>
    </section>
  );
}

// ============================================
// 二要素認証セクション
// ============================================

function TwoFactorSection({ totpEnabled }: { totpEnabled: boolean }) {
  return (
    <section className="bg-background-secondary border border-border rounded-lg p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">二要素認証</h2>
      {totpEnabled ? <TwoFactorEnabled /> : <TwoFactorDisabled />}
    </section>
  );
}

function TwoFactorDisabled() {
  const [step, setStep] = useState<'idle' | 'setup' | 'verify'>('idle');
  const [qrData, setQrData] = useState<{ qrCodeDataUrl: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const { mutate: setup, isLoading: isSettingUp, error: setupError } = useSetup2FA();
  const { mutate: enable, isLoading: isEnabling, error: enableError } = useEnable2FA();

  const handleSetup = async () => {
    try {
      const data = await setup();
      setQrData(data);
      setStep('setup');
    } catch {
      // エラーはフックで管理
    }
  };

  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await enable(code);
      // 有効化成功 → ストアが更新され、TwoFactorEnabledに切り替わる
    } catch {
      // エラーはフックで管理
    }
  };

  const error = setupError || enableError;

  if (step === 'idle') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <ShieldOff className="w-5 h-5 text-foreground-muted" />
          <span className="text-sm text-foreground-muted">二要素認証は無効です</span>
        </div>
        <button onClick={handleSetup} disabled={isSettingUp} className="btn btn-primary">
          {isSettingUp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          セットアップを開始
        </button>
        {error && (
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <QrCode className="w-5 h-5 text-accent" />
        <span className="text-sm text-foreground">認証アプリでQRコードをスキャンしてください</span>
      </div>

      {qrData && (
        <div className="space-y-3">
          <div className="bg-white p-4 rounded-lg inline-block">
            <img src={qrData.qrCodeDataUrl} alt="2FA QRコード" className="w-48 h-48" />
          </div>
          <div>
            <p className="text-xs text-foreground-muted mb-1">手動入力用シークレットキー:</p>
            <code className="text-sm font-mono bg-background-tertiary px-2 py-1 rounded select-all">
              {qrData.secret}
            </code>
          </div>
        </div>
      )}

      <form onSubmit={handleEnable} className="space-y-4">
        <div>
          <label htmlFor="totpCode" className="block text-sm font-medium text-foreground-muted mb-1">
            認証コード
          </label>
          <input
            id="totpCode"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="input w-40"
            placeholder="000000"
            maxLength={6}
            pattern="[0-9]{6}"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-error">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error.message}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={isEnabling || code.length !== 6} className="btn btn-primary">
            {isEnabling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            有効化
          </button>
          <button
            type="button"
            onClick={() => { setStep('idle'); setCode(''); setQrData(null); }}
            className="btn btn-ghost"
          >
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}

function TwoFactorEnabled() {
  const [showDisable, setShowDisable] = useState(false);
  const [password, setPassword] = useState('');
  const { mutate: disable, isLoading, error } = useDisable2FA();

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await disable(password);
      // 無効化成功 → ストアが更新され、TwoFactorDisabledに切り替わる
    } catch {
      // エラーはフックで管理
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5 text-success" />
        <span className="text-sm text-success">二要素認証は有効です</span>
      </div>

      {!showDisable ? (
        <button
          onClick={() => setShowDisable(true)}
          className="btn btn-ghost text-error hover:text-error"
        >
          無効化
        </button>
      ) : (
        <form onSubmit={handleDisable} className="space-y-4">
          <div>
            <label htmlFor="disablePassword" className="block text-sm font-medium text-foreground-muted mb-1">
              パスワードを入力して確認
            </label>
            <input
              id="disablePassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input w-full max-w-md"
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error.message}</span>
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={isLoading || password === ''} className="btn btn-primary bg-error hover:bg-error/80">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              無効化する
            </button>
            <button
              type="button"
              onClick={() => { setShowDisable(false); setPassword(''); }}
              className="btn btn-ghost"
            >
              キャンセル
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
