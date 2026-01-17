import { FileText, Clock, TrendingUp, Play } from 'lucide-react';
import type { ProjectDashboardStats } from '@agentest/shared';
import { SummaryCard, type SummaryCardColor } from '../../ui';
import { formatRelativeTimeOrDefault } from '../../../lib/date';

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * 成功率に基づく色を取得
 */
function getPassRateColor(rate: number): SummaryCardColor {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

/**
 * 実行中テスト数に基づく色を取得
 */
function getRunningColor(count: number): SummaryCardColor {
  return count > 0 ? 'running' : 'muted';
}

// ============================================================================
// 公開コンポーネント
// ============================================================================

interface KpiSummaryCardsProps {
  /** ダッシュボード統計データ */
  stats: ProjectDashboardStats;
}

/**
 * KPIサマリーカード
 * プロジェクトのテスト状況を4つのカードで表示
 */
export function KpiSummaryCards({ stats }: KpiSummaryCardsProps) {
  const { summary } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* テストケース総数 */}
      <SummaryCard
        icon={FileText}
        label="テストケース"
        value={summary.totalTestCases}
        color="accent"
      />

      {/* 最終実行日時 */}
      <SummaryCard
        icon={Clock}
        label="最終実行"
        value={formatRelativeTimeOrDefault(summary.lastExecutionAt)}
        color="muted"
      />

      {/* 成功率 */}
      <SummaryCard
        icon={TrendingUp}
        label="成功率"
        value={`${Math.floor(summary.overallPassRate)}%`}
        color={getPassRateColor(summary.overallPassRate)}
      />

      {/* 実行中テスト */}
      <SummaryCard
        icon={Play}
        label="実行中"
        value={summary.inProgressExecutions}
        color={getRunningColor(summary.inProgressExecutions)}
      />
    </div>
  );
}
