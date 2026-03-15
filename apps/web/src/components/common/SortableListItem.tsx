import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ActionDropdown } from './ActionDropdown';

/**
 * インデックス番号のカラーバリアント
 */
export type IndexColorVariant = 'default' | 'accent' | 'success';

const INDEX_COLORS: Record<IndexColorVariant, string> = {
  default: 'bg-background-tertiary text-foreground-muted',
  accent: 'bg-accent text-white',
  success: 'bg-success text-white',
};

interface SortableListItemProps {
  /** アイテムのID */
  id: string;
  /** 表示するインデックス番号（1始まり） */
  index: number;
  /** 表示する内容 */
  content: string;
  /** インデックス番号の色 */
  indexColor?: IndexColorVariant;
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
  /** 並び替え中フラグ（競合状態防止のためドラッグを無効化） */
  isReordering: boolean;
  /** アクションドロップダウンのaria-label */
  actionAriaLabel?: string;
}

/**
 * ソート可能なリストアイテム
 */
export function SortableListItem({
  id,
  index,
  content,
  indexColor = 'default',
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  isUpdating,
  isReordering,
  actionAriaLabel,
}: SortableListItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canEdit || isReordering,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center justify-between p-3 rounded-lg border bg-background-secondary
        transition-colors
        ${isDragging ? 'opacity-50 border-accent shadow-lg z-10' : 'border-border'}
        hover:bg-background-tertiary
      `}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* ドラッグハンドル */}
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 text-foreground-muted hover:text-foreground"
            aria-label="ドラッグして並び替え"
          >
            <GripVertical className="w-4 h-4 flex-shrink-0" />
          </button>
        )}

        {/* インデックス番号 */}
        <span
          className={`w-6 h-6 rounded-full text-xs font-medium flex items-center justify-center flex-shrink-0 ${INDEX_COLORS[indexColor]}`}
        >
          {index}
        </span>

        {/* 内容 */}
        <p className="text-sm text-foreground truncate">{content}</p>
      </div>

      {/* アクションメニュー */}
      <ActionDropdown
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
        isUpdating={isUpdating}
        ariaLabel={actionAriaLabel}
      />
    </div>
  );
}
