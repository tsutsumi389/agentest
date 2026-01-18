interface ProgressBarProps {
  /** 成功数 */
  passed: number;
  /** 失敗数 */
  failed: number;
  /** スキップ数 */
  skipped?: number;
  /** 合計数 */
  total: number;
  /** サイズ */
  size?: 'sm' | 'md' | 'lg';
  /** ラベルを表示するか */
  showLabel?: boolean;
}

/**
 * テスト進捗バーコンポーネント
 * テスト実行の成功/失敗/スキップ状況を視覚化
 */
export function ProgressBar({
  passed,
  failed,
  skipped = 0,
  total,
  size = 'md',
  showLabel = false,
}: ProgressBarProps) {
  // 0除算を防止
  if (total === 0) {
    return (
      <div className="h-2 bg-background-tertiary rounded-full" />
    );
  }

  const passedPercent = (passed / total) * 100;
  const failedPercent = (failed / total) * 100;
  const skippedPercent = (skipped / total) * 100;

  const sizeClass = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="space-y-1">
      <div
        className={`${sizeClass[size]} bg-background-tertiary rounded-full overflow-hidden flex`}
        role="progressbar"
        aria-valuenow={passed + failed + skipped}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`テスト進捗: 成功 ${passed}件, 失敗 ${failed}件, スキップ ${skipped}件 / 全${total}件`}
      >
        {/* 成功 */}
        <div
          className="bg-success transition-all duration-300 ease-out"
          style={{ width: `${passedPercent}%` }}
        />
        {/* 失敗 */}
        <div
          className="bg-danger transition-all duration-300 ease-out"
          style={{ width: `${failedPercent}%` }}
        />
        {/* スキップ */}
        <div
          className="bg-foreground-subtle transition-all duration-300 ease-out"
          style={{ width: `${skippedPercent}%` }}
        />
      </div>

      {showLabel && (
        <div className="flex justify-between text-xs text-foreground-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-success" />
            成功 {passed}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-danger" />
            失敗 {failed}
          </span>
          {skipped > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-foreground-subtle" />
              スキップ {skipped}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * シンプルな進捗バー
 * 単一の進捗表示用
 */
export function SimpleProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'accent',
}: {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'accent' | 'success' | 'warning' | 'danger';
}) {
  const percent = Math.min((value / max) * 100, 100);

  const sizeClass = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const colorClass = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  };

  return (
    <div
      className={`${sizeClass[size]} bg-background-tertiary rounded-full overflow-hidden`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <div
        className={`h-full ${colorClass[color]} transition-all duration-300 ease-out`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
