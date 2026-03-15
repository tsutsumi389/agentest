import { useState } from 'react';
import {
  KpiSummaryCards,
  ResultDistributionChart,
  ExecutionStatusTable,
  RecentActivityTimeline,
  DashboardFilters,
} from './dashboard';
import { useProjectDashboard } from '../../hooks/useProjectDashboard';

interface ProjectOverviewTabProps {
  projectId: string;
}

/**
 * プロジェクト概要タブ
 * テスト状況のサマリーを表示
 * WebSocketでリアルタイム更新に対応
 */
export function ProjectOverviewTab({ projectId }: ProjectOverviewTabProps) {
  // フィルター状態
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | undefined>();
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  // WebSocket対応のダッシュボードフック
  const { stats, environments, labels, isLoading, error } = useProjectDashboard({
    projectId,
    environmentId: selectedEnvironmentId,
    labelIds: selectedLabelIds,
  });

  if (isLoading && !stats) {
    return <div className="text-foreground-muted">読み込み中...</div>;
  }

  if (error || !stats) {
    return <div className="text-danger">{error || 'データの取得に失敗しました'}</div>;
  }

  return (
    <div className="space-y-6">
      {/* フィルター */}
      <DashboardFilters
        environments={environments}
        selectedEnvironmentId={selectedEnvironmentId}
        onEnvironmentChange={setSelectedEnvironmentId}
        labels={labels}
        selectedLabelIds={selectedLabelIds}
        onLabelChange={setSelectedLabelIds}
      />

      {/* KPIサマリーカード（3枚） */}
      <KpiSummaryCards stats={stats} />

      {/* 実行結果の分布 + 最近の活動（横並び・高さ揃え） */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ResultDistributionChart stats={stats} className="h-full" />
        <RecentActivityTimeline stats={stats} className="h-full" />
      </div>

      {/* テスト実行状況 */}
      <ExecutionStatusTable stats={stats} />
    </div>
  );
}
