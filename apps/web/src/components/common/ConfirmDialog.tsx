import { useEffect, useRef } from 'react';
import { Loader2, X, AlertTriangle } from 'lucide-react';

export interface ConfirmDialogProps {
  /** ダイアログの表示状態 */
  isOpen: boolean;
  /** ダイアログのタイトル */
  title: string;
  /** ダイアログのメッセージ */
  message: string;
  /** 確認ボタンのラベル */
  confirmLabel: string;
  /** 確認ボタンクリック時のコールバック */
  onConfirm: () => void;
  /** キャンセルボタンクリック時のコールバック */
  onCancel: () => void;
  /** ローディング状態 */
  isLoading?: boolean;
  /** 危険な操作かどうか（赤色のスタイルになる） */
  isDanger?: boolean;
}

/**
 * 確認ダイアログコンポーネント
 *
 * アクセシビリティ対応:
 * - ESCキーでダイアログを閉じる
 * - フォーカストラップ（Tab/Shift+Tabでダイアログ内のみ移動）
 * - aria属性による適切なラベリング
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  isLoading,
  isDanger = true,
}: ConfirmDialogProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // ESCキーでモーダルを閉じる + フォーカストラップ + 背景スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    // 背景スクロールを無効化
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements =
          modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // フォーカスをダイアログに移動
    cancelButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // 背景スクロールを復元
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      {/* ダイアログ */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg max-w-md w-full mx-4 p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              isDanger ? 'bg-danger-subtle' : 'bg-warning-subtle'
            }`}
          >
            <AlertTriangle className={`w-5 h-5 ${isDanger ? 'text-danger' : 'text-warning'}`} />
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-lg font-semibold text-foreground">
              {title}
            </h3>
            <p className="text-sm text-foreground-muted mt-1">{message}</p>
          </div>
          <button
            onClick={onCancel}
            className="flex-shrink-0 text-foreground-subtle hover:text-foreground"
            disabled={isLoading}
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            ref={cancelButtonRef}
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            キャンセル
          </button>
          <button
            className={isDanger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
