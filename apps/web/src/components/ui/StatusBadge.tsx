import { CheckCircle, XCircle, Loader, Clock, SkipForward } from 'lucide-react';

/**
 * テスト状態の型定義
 */
export type TestStatus = 'passed' | 'failed' | 'running' | 'pending' | 'skipped';

/**
 * 状態ごとの設定
 */
const statusConfig: Record<
  TestStatus,
  {
    icon: React.ElementType;
    className: string;
    label: string;
  }
> = {
  passed: {
    icon: CheckCircle,
    className: 'bg-success-subtle text-success',
    label: '成功',
  },
  failed: {
    icon: XCircle,
    className: 'bg-danger-subtle text-danger',
    label: '失敗',
  },
  running: {
    icon: Loader,
    className: 'bg-running-subtle text-running',
    label: '実行中',
  },
  pending: {
    icon: Clock,
    className: 'bg-warning-subtle text-warning',
    label: '待機中',
  },
  skipped: {
    icon: SkipForward,
    className: 'bg-warning-subtle text-warning',
    label: 'スキップ',
  },
};

interface StatusBadgeProps {
  /** テスト状態 */
  status: TestStatus;
  /** ラベルを表示するか */
  showLabel?: boolean;
  /** カスタムクラス */
  className?: string;
}

/**
 * テスト状態バッジコンポーネント
 * ガイドライン準拠: subtle背景 + 強調テキスト
 */
export function StatusBadge({ status, showLabel = true, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const isRunning = status === 'running';

  return (
    <span
      className={`badge ${config.className} ${className}`}
      role="status"
      aria-label={config.label}
    >
      <Icon className={`w-3 h-3 ${isRunning ? 'animate-spin' : ''}`} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
