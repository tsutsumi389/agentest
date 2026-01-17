/**
 * サマリーカードコンポーネント
 * KPI表示などに使用する統一されたカードUI
 */

/** サマリーカードの色タイプ */
export type SummaryCardColor =
  | 'success'
  | 'danger'
  | 'warning'
  | 'muted'
  | 'accent'
  | 'running';

interface SummaryCardProps {
  /** アイコンコンポーネント */
  icon: React.ElementType;
  /** ラベル */
  label: string;
  /** 値（数値または文字列） */
  value: string | number;
  /** 色 */
  color: SummaryCardColor;
}

/** 色に対応するTailwindクラス */
const colorClasses: Record<SummaryCardColor, string> = {
  success: 'bg-success-subtle text-success',
  danger: 'bg-danger-subtle text-danger',
  warning: 'bg-warning-subtle text-warning',
  muted: 'bg-background-tertiary text-foreground-muted',
  accent: 'bg-accent-subtle text-accent',
  running: 'bg-running-subtle text-running',
};

/**
 * サマリーカード
 * アイコン、値、ラベルを表示するカードコンポーネント
 */
export function SummaryCard({ icon: Icon, label, value, color }: SummaryCardProps) {
  const isRunning = color === 'running';

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}
        >
          <Icon className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
