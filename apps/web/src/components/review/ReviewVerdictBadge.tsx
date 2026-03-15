import { CheckCircle, AlertTriangle, MessageSquare } from 'lucide-react';
import type { ReviewVerdict } from '../../lib/api';

/**
 * 評価ごとの設定
 */
const VERDICT_CONFIG: Record<
  ReviewVerdict,
  {
    icon: typeof CheckCircle;
    className: string;
    label: string;
  }
> = {
  APPROVED: {
    icon: CheckCircle,
    className: 'bg-success-subtle text-success',
    label: '承認',
  },
  CHANGES_REQUESTED: {
    icon: AlertTriangle,
    className: 'bg-warning-subtle text-warning',
    label: '要修正',
  },
  COMMENT_ONLY: {
    icon: MessageSquare,
    className: 'bg-background-tertiary text-foreground-subtle',
    label: 'コメントのみ',
  },
};

interface ReviewVerdictBadgeProps {
  /** レビュー評価 */
  verdict: ReviewVerdict;
  /** ラベルを表示するか */
  showLabel?: boolean;
  /** カスタムクラス */
  className?: string;
}

/**
 * レビュー評価バッジコンポーネント
 * APPROVED/CHANGES_REQUESTED/COMMENT_ONLYの状態を視覚的に表示
 */
export function ReviewVerdictBadge({
  verdict,
  showLabel = true,
  className = '',
}: ReviewVerdictBadgeProps) {
  const config = VERDICT_CONFIG[verdict];
  const Icon = config.icon;

  return (
    <span
      className={`badge ${config.className} ${className}`}
      role="status"
      aria-label={config.label}
    >
      <Icon className="w-3 h-3" />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
