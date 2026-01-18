import { DonutChart, type DonutSegment } from '../../ui';
import type { ProjectDashboardStats } from '@agentest/shared';

/** セグメントの設定（ステータス→色・ラベルのマッピング） */
const SEGMENT_CONFIG = {
  pass: { label: '成功', color: '#3fb950' },
  fail: { label: '失敗', color: '#f85149' },
  pending: { label: '未判定', color: '#d29922' },
  skipped: { label: 'スキップ', color: '#6e7681' },
} as const;

type SegmentKey = keyof typeof SEGMENT_CONFIG;

/** セグメントの表示順序を明示的に定義 */
const SEGMENT_ORDER: SegmentKey[] = ['pass', 'fail', 'pending', 'skipped'];

interface LegendItemProps {
  color: string;
  label: string;
  count: number;
  percentage: number;
}

/**
 * 凡例アイテム
 */
function LegendItem({ color, label, count, percentage }: LegendItemProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-foreground-secondary text-sm">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="text-foreground font-medium tabular-nums w-8 text-right">
          {count}
        </span>
        <span className="text-foreground-muted tabular-nums w-16 text-right">
          ({percentage.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

interface ResultDistributionChartProps {
  stats: ProjectDashboardStats;
}

/**
 * 実行結果の分布を表示するドーナツチャート
 */
export function ResultDistributionChart({ stats }: ResultDistributionChartProps) {
  const { resultDistribution } = stats;

  // セグメントデータを構築
  const segments: DonutSegment[] = SEGMENT_ORDER.map((key) => ({
    id: key,
    label: SEGMENT_CONFIG[key].label,
    value: resultDistribution[key],
    color: SEGMENT_CONFIG[key].color,
  }));

  // 合計を計算
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // 中央に表示するコンテンツ
  const centerContent = (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold text-foreground">{total}</span>
      <span className="text-xs text-foreground-muted">総実行数</span>
    </div>
  );

  return (
    <div className="bg-background-secondary border border-border rounded-lg p-4">
      <h3 className="text-foreground font-medium mb-4">実行結果の分布</h3>

      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* ドーナツチャート */}
        <div className="shrink-0">
          <DonutChart
            segments={segments}
            size={160}
            thickness={0.25}
            centerContent={centerContent}
            emptyMessage="実行データがありません"
            ariaLabel={`実行結果の分布: 総実行数 ${total}件`}
          />
        </div>

        {/* 凡例 */}
        <div className="flex-1 w-full space-y-2">
          {segments.map((segment) => (
            <LegendItem
              key={segment.id}
              color={segment.color}
              label={segment.label}
              count={segment.value}
              percentage={total > 0 ? (segment.value / total) * 100 : 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
