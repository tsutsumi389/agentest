import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import { organizationsApi, ApiError, type Organization } from '../../lib/api';
import { toast } from '../../stores/toast';

interface DeleteOrganizationModalProps {
  /** モーダルが開いているかどうか */
  isOpen: boolean;
  /** 組織情報 */
  organization: Organization;
  /** モーダルを閉じる */
  onClose: () => void;
  /** 削除成功時のコールバック */
  onSuccess?: () => void;
}

/**
 * 組織削除モーダル
 *
 * 組織名を入力して確認後、組織を削除する。
 * 削除は論理削除で、30日後に物理削除される。
 */
export function DeleteOrganizationModal({
  isOpen,
  organization,
  onClose,
  onSuccess,
}: DeleteOrganizationModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  // 確認入力
  const [confirmInput, setConfirmInput] = useState('');

  // UI状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // フォームをリセットする
  const resetForm = useCallback(() => {
    setConfirmInput('');
    setError(null);
  }, []);

  // モーダルが開いたらリセットしてフォーカス
  useEffect(() => {
    if (isOpen) {
      resetForm();
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        confirmInputRef.current?.focus();
      });
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, resetForm]);

  // キーボードイベントハンドラー
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current) return;

      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // フォーカストラップ
      if (e.key === 'Tab') {
        const focusableSelector = [
          'button:not([disabled])',
          'input:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', ');
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(focusableSelector);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [isOpen, onClose]
  );

  // キーボードイベントリスナー
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  // 削除を実行
  const handleDelete = async () => {
    if (confirmInput !== organization.name) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await organizationsApi.delete(organization.id);
      toast.success('組織を削除しました');
      onSuccess?.();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('組織の削除に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // フォーム送信
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleDelete();
  };

  // 確認入力が一致するか
  const isConfirmValid = confirmInput === organization.name;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-org-title"
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-background-secondary border border-border rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-danger/10">
              <Trash2 className="w-5 h-5 text-danger" aria-hidden="true" />
            </div>
            <h2 id="delete-org-title" className="text-lg font-semibold text-foreground">
              組織を削除
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-md transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            {/* エラー表示 */}
            {error && (
              <div className="mb-4 p-3 text-sm text-danger bg-danger-subtle border border-danger/20 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* 警告 */}
            <div className="mb-4 p-3 bg-danger/10 border border-danger/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-foreground mb-1">この操作は危険です</p>
                  <p className="text-foreground-muted">
                    組織を削除すると、すべてのプロジェクト、テストケース、メンバー情報が削除されます。
                  </p>
                </div>
              </div>
            </div>

            {/* 復元可能期間の説明 */}
            <div className="mb-4 p-3 bg-background-tertiary rounded-lg text-sm">
              <p className="text-foreground-muted">
                <span className="font-medium text-foreground">30日以内であれば復元可能です。</span>
                <br />
                30日経過後は完全に削除され、復元できなくなります。
              </p>
            </div>

            {/* 削除対象の確認 */}
            <div className="mb-4 p-3 bg-background-tertiary rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-foreground-muted">削除対象:</span>
                <span className="font-medium text-foreground">{organization.name}</span>
                <span className="text-foreground-muted">/{organization.slug}</span>
              </div>
            </div>

            {/* 確認入力 */}
            <div>
              <label htmlFor="confirm-delete-org-name" className="block text-sm font-medium text-foreground mb-1.5">
                確認のため組織名を入力してください
              </label>
              <input
                ref={confirmInputRef}
                id="confirm-delete-org-name"
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={organization.name}
                className="input w-full"
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-foreground-muted">
                「<span className="font-mono text-foreground">{organization.name}</span>」と入力
              </p>
            </div>
          </div>

          {/* フッター */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={!isConfirmValid || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  削除中...
                </>
              ) : (
                '組織を削除'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
