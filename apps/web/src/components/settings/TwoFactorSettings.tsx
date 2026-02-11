import { useState, useEffect, useCallback } from 'react';
import { Shield, Loader2 } from 'lucide-react';
import { toast } from '../../stores/toast';
import { authApi } from '../../lib/api';

type TwoFactorStep = 'idle' | 'setup' | 'disable';

/** QRコードデータURLの安全性を検証 */
function isValidQrCodeDataUrl(url: string): boolean {
  return url.startsWith('data:image/png;base64,') || url.startsWith('data:image/jpeg;base64,');
}

/**
 * 二要素認証設定コンポーネント
 */
export function TwoFactorSettings() {
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<TwoFactorStep>('idle');

  // セットアップ状態
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeDataUrl: string;
  } | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState('');
  const [isEnabling, setIsEnabling] = useState(false);

  // 無効化状態
  const [disablePassword, setDisablePassword] = useState('');
  const [disableError, setDisableError] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);

  // 2FAステータスを取得
  const fetchStatus = useCallback(async () => {
    try {
      const response = await authApi.get2FAStatus();
      setTotpEnabled(response.totpEnabled);
    } catch {
      // 取得失敗時は初期状態のまま
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // セットアップ開始
  const handleStartSetup = async () => {
    try {
      const response = await authApi.setup2FA();
      setSetupData({
        secret: response.secret,
        qrCodeDataUrl: response.qrCodeDataUrl,
      });
      setSetupCode('');
      setSetupError('');
      setStep('setup');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'セットアップに失敗しました';
      toast.error(message);
    }
  };

  // セットアップキャンセル
  const handleCancelSetup = () => {
    setStep('idle');
    setSetupData(null);
    setSetupCode('');
    setSetupError('');
  };

  // 2FA有効化
  const handleEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setIsEnabling(true);

    try {
      await authApi.enable2FA(setupCode);
      setTotpEnabled(true);
      setStep('idle');
      setSetupData(null);
      setSetupCode('');
      toast.success('二要素認証を有効にしました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '有効化に失敗しました';
      setSetupError(message);
    } finally {
      setIsEnabling(false);
    }
  };

  // 無効化フロー開始
  const handleStartDisable = () => {
    setDisablePassword('');
    setDisableError('');
    setStep('disable');
  };

  // 無効化キャンセル
  const handleCancelDisable = () => {
    setStep('idle');
    setDisablePassword('');
    setDisableError('');
  };

  // 2FA無効化
  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisableError('');
    setIsDisabling(true);

    try {
      await authApi.disable2FA(disablePassword);
      setTotpEnabled(false);
      setStep('idle');
      setDisablePassword('');
      toast.success('二要素認証を無効にしました');
    } catch (err) {
      const message = err instanceof Error ? err.message : '無効化に失敗しました';
      setDisableError(message);
    } finally {
      setIsDisabling(false);
    }
  };

  // 数字のみ、最大6桁に制限
  const handleCodeChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setSetupCode(digits);
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">二要素認証</h2>
          <p className="text-sm text-foreground-muted mt-1">
            {totpEnabled
              ? '二要素認証は有効です'
              : '二要素認証は無効です'}
          </p>
        </div>
        {step === 'idle' && (
          totpEnabled ? (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleStartDisable}
            >
              無効にする
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={handleStartSetup}
            >
              <Shield className="w-4 h-4" />
              セットアップ
            </button>
          )
        )}
      </div>

      {/* セットアップフロー */}
      {step === 'setup' && setupData && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-foreground-muted mb-3">
                認証アプリ（Google Authenticator、Authy等）で以下のQRコードをスキャンしてください。
              </p>
              <div className="flex justify-center mb-3">
                {isValidQrCodeDataUrl(setupData.qrCodeDataUrl) ? (
                  <img
                    src={setupData.qrCodeDataUrl}
                    alt="2FA QRコード"
                    className="w-48 h-48"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-background-tertiary rounded text-foreground-muted text-sm">
                    QRコードを表示できません
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-xs text-foreground-muted mb-1">
                  QRコードをスキャンできない場合は、以下のキーを手動で入力してください:
                </p>
                <code className="text-sm bg-background-tertiary px-3 py-1 rounded font-mono">
                  {setupData.secret}
                </code>
              </div>
            </div>

            <form onSubmit={handleEnable} className="space-y-3">
              {setupError && (
                <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                  {setupError}
                </div>
              )}

              <div>
                <label htmlFor="setup-totp-code" className="block text-sm font-medium text-foreground mb-1">
                  認証コード
                </label>
                <input
                  id="setup-totp-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={setupCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  className="input w-full text-center text-lg tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleCancelSetup}
                  disabled={isEnabling}
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isEnabling || setupCode.length !== 6}
                >
                  {isEnabling && <Loader2 className="w-4 h-4 animate-spin" />}
                  有効にする
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 無効化フロー */}
      {step === 'disable' && (
        <div className="mt-4 border-t border-border pt-4">
          <form onSubmit={handleDisable} className="space-y-3">
            <p className="text-sm text-foreground-muted">
              二要素認証を無効にするには、パスワードを入力してください。
            </p>

            {disableError && (
              <div role="alert" className="text-sm text-error bg-error/10 border border-error/20 rounded-md px-3 py-2">
                {disableError}
              </div>
            )}

            <div>
              <label htmlFor="disable-password" className="block text-sm font-medium text-foreground mb-1">
                パスワード
              </label>
              <input
                id="disable-password"
                type="password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                className="input w-full"
                placeholder="パスワードを入力"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCancelDisable}
                disabled={isDisabling}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={isDisabling || !disablePassword}
              >
                {isDisabling && <Loader2 className="w-4 h-4 animate-spin" />}
                二要素認証を無効にする
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
