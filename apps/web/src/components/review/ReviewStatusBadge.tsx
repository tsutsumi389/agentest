import { CheckCircle2, MessageCircle } from 'lucide-react';
import type { ReviewStatus } from '../../lib/api';

/**
 * ステータス設定
 */
const STATUS_CONFIG: Record<ReviewStatus, {
  icon: typeof CheckCircle2;
  className: string;
  label: string;
}> = {
  OPEN: {
    icon: MessageCircle,
    className: 'bg-warning/20 text-warning',
    label: '未解決',
  },
  RESOLVED: {
    icon: CheckCircle2,
    className: 'bg-success/20 text-success',
    label: '解決済み',
  },
};

interface ReviewStatusBadgeProps {
  /** レビューステータス */
  status: ReviewStatus;
  /** ラベルを表示するか */
  showLabel?: boolean;
  /** カスタムクラス */
  className?: string;
}

/**
 * レビューステータスバッジ
 * OPEN/RESOLVEDの状態を視覚的に表示
 */
export function ReviewStatusBadge({
  status,
  showLabel = true,
  className = '',
}: ReviewStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${config.className} ${className}`}
      role="status"
      aria-label={config.label}
    >
      <Icon className="w-3 h-3" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
