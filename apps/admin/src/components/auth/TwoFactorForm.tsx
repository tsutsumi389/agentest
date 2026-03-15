import {
  useState,
  useRef,
  useEffect,
  type KeyboardEvent,
  type ClipboardEvent,
  type ChangeEvent,
} from 'react';
import { Loader2, AlertCircle, Shield } from 'lucide-react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const CODE_LENGTH = 6;

/**
 * 2FAフォームコンポーネント
 * 6桁の認証コード入力
 */
export function TwoFactorForm() {
  const { verify2FA, logout, error, isLoading, clearError } = useAdminAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // 送信済みフラグ（Strict Modeでの二重実行防止）
  const isSubmittingRef = useRef(false);

  // 最初の入力欄にフォーカス
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // 全桁入力されたら自動送信
  useEffect(() => {
    const code = digits.join('');
    if (code.length === CODE_LENGTH && digits.every((d) => d !== '') && !isSubmittingRef.current) {
      // 送信済みフラグを立てる
      isSubmittingRef.current = true;
      clearError();
      verify2FA(code)
        .catch(() => {
          // エラー時は入力をクリア
          setDigits(Array(CODE_LENGTH).fill(''));
          inputRefs.current[0]?.focus();
        })
        .finally(() => {
          // 送信完了後にフラグをリセット
          isSubmittingRef.current = false;
        });
    }
  }, [digits, clearError, verify2FA]);

  const handleChange = (index: number, value: string) => {
    // 数字のみ許可
    const digit = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    // 次の入力欄にフォーカス
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Backspaceで前の入力欄にフォーカス
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    // 矢印キーで移動
    if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const pastedDigits = pastedData.replace(/\D/g, '').slice(0, CODE_LENGTH);

    if (pastedDigits.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < pastedDigits.length && i < CODE_LENGTH; i++) {
        newDigits[i] = pastedDigits[i];
      }
      setDigits(newDigits);

      // 最後の入力欄にフォーカス
      const focusIndex = Math.min(pastedDigits.length, CODE_LENGTH - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  const handleCancel = async () => {
    await logout();
  };

  return (
    <div className="space-y-6">
      {/* CLI風の装飾 */}
      <div className="font-mono text-sm text-foreground-muted mb-4">
        <span className="text-accent">$</span> admin --verify-2fa
      </div>

      {/* アイコンと説明 */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
          <Shield className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="text-sm font-medium text-foreground">二要素認証</h3>
          <p className="text-xs text-foreground-muted">認証アプリの6桁コードを入力してください</p>
        </div>
      </div>

      {/* エラーメッセージ */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-3 rounded-md bg-danger-muted text-danger"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <p>認証コードが正しくありません</p>
          </div>
        </div>
      )}

      {/* 6桁入力欄 */}
      <div className="flex justify-center gap-2" role="group" aria-label="認証コード入力">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className="w-12 h-14 text-center text-xl font-mono font-bold bg-background-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-colors disabled:opacity-50"
            disabled={isLoading}
            autoComplete="one-time-code"
            aria-label={`認証コード ${index + 1}桁目`}
          />
        ))}
      </div>

      {/* ローディング表示 */}
      {isLoading && (
        <div
          className="flex items-center justify-center gap-2 text-foreground-muted"
          aria-live="polite"
        >
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span className="text-sm">検証中...</span>
        </div>
      )}

      {/* キャンセルボタン */}
      <div className="pt-4 border-t border-border">
        <button
          type="button"
          onClick={handleCancel}
          className="btn btn-ghost w-full"
          disabled={isLoading}
        >
          キャンセル（ログアウト）
        </button>
      </div>
    </div>
  );
}
