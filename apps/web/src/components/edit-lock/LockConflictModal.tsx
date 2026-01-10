import { Lock, X } from 'lucide-react';

/**
 * ロック所有者情報
 */
interface LockHolder {
  type: 'user' | 'agent';
  id: string;
  name: string;
}

interface LockConflictModalProps {
  /** モーダル表示状態 */
  isOpen: boolean;
  /** 閉じる処理 */
  onClose: () => void;
  /** ロック所有者情報 */
  lockHolder: LockHolder | null;
  /** 再試行処理 */
  onRetry?: () => void;
}

/**
 * ロック競合モーダル
 * 他者が編集中の場合に表示
 */
export function LockConflictModal({
  isOpen,
  onClose,
  lockHolder,
  onRetry,
}: LockConflictModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="modal-content modal-sm" role="dialog" aria-modal="true">
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-medium">編集がブロックされました</h2>
          </div>
          <button
            onClick={onClose}
            className="btn-icon-ghost"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-body">
          <p className="text-foreground-subtle">
            <span className="font-medium text-foreground">
              {lockHolder?.name ?? '他のユーザー'}
            </span>
            が現在このリソースを編集中です。
          </p>
          <p className="text-foreground-subtle mt-2 text-sm">
            編集が完了するまでお待ちいただくか、後ほど再度お試しください。
          </p>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            閉じる
          </button>
          {onRetry && (
            <button onClick={onRetry} className="btn btn-primary">
              再試行
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
