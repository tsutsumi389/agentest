import { FolderKanban, FileText, CheckSquare } from 'lucide-react';
import type { ProjectDashboardStats } from '@agentest/shared';
import { SummaryCard } from '../../ui';

interface KpiSummaryCardsProps {
  /** ダッシュボード統計データ */
  stats: ProjectDashboardStats;
}

/**
 * KPIサマリーカード
 * プロジェクトのテスト状況を3つのカードで表示
 */
export function KpiSummaryCards({ stats }: KpiSummaryCardsProps) {
  const { summary } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* テストスイート数 */}
      <SummaryCard
        icon={FolderKanban}
        label="テストスイート"
        value={summary.totalTestSuites}
        color="accent"
      />

      {/* テストケース数 */}
      <SummaryCard
        icon={FileText}
        label="テストケース"
        value={summary.totalTestCases}
        color="accent"
      />

      {/* 期待結果数 */}
      <SummaryCard
        icon={CheckSquare}
        label="期待結果"
        value={summary.totalExpectedResults}
        color="accent"
      />
    </div>
  );
}
