import { X } from 'lucide-react';
import type { Label } from '../../lib/api';
import { getContrastTextColor } from '../../lib/color-utils';

interface LabelBadgeProps {
  /** ラベルデータ */
  label: Label;
  /** 削除ボタンを表示するか */
  removable?: boolean;
  /** 削除時のコールバック */
  onRemove?: () => void;
  /** カスタムクラス */
  className?: string;
}

/**
 * ラベルバッジコンポーネント
 * GitHubのラベルのような表示
 */
export function LabelBadge({ label, removable = false, onRemove, className = '' }: LabelBadgeProps) {
  const textColor = getContrastTextColor(label.color);

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={{ backgroundColor: label.color, color: textColor }}
      title={label.description || undefined}
    >
      <span className="truncate max-w-[120px]">{label.name}</span>
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70 focus:outline-none"
          aria-label={`${label.name}を削除`}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

interface LabelBadgeListProps {
  /** ラベル一覧 */
  labels: Label[];
  /** 削除可能か */
  removable?: boolean;
  /** ラベル削除時のコールバック */
  onRemove?: (labelId: string) => void;
  /** 空の場合のプレースホルダー */
  emptyText?: string;
  /** カスタムクラス */
  className?: string;
}

/**
 * ラベルバッジリストコンポーネント
 */
export function LabelBadgeList({
  labels,
  removable = false,
  onRemove,
  emptyText = 'ラベルなし',
  className = '',
}: LabelBadgeListProps) {
  if (labels.length === 0) {
    return <span className="text-foreground-subtle text-xs">{emptyText}</span>;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {labels.map((label) => (
        <LabelBadge
          key={label.id}
          label={label}
          removable={removable}
          onRemove={onRemove ? () => onRemove(label.id) : undefined}
        />
      ))}
    </div>
  );
}
