import { useState, useEffect, useRef } from 'react';
import { Loader2, MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface ActionDropdownProps {
  /** 編集可能か */
  canEdit: boolean;
  /** 削除可能か */
  canDelete: boolean;
  /** 編集クリック時のハンドラ */
  onEdit: () => void;
  /** 削除クリック時のハンドラ */
  onDelete: () => void;
  /** 更新中フラグ */
  isUpdating: boolean;
  /** アクセシビリティ用ラベル */
  ariaLabel?: string;
}

/**
 * 編集・削除アクションドロップダウン
 */
export function ActionDropdown({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  isUpdating,
  ariaLabel = '操作メニュー',
}: ActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリック・ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // 表示できる操作がなければ何も表示しない
  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
        disabled={isUpdating}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreVertical className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-32 bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="menu"
        >
          {canEdit && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
          )}

          {canDelete && (
            <>
              {canEdit && <div className="border-t border-border my-1" />}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors"
                onClick={() => {
                  onDelete();
                  setIsOpen(false);
                }}
                role="menuitem"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
