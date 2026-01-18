import { useEffect, useState, useCallback } from 'react';
import { KpiSummaryCards, ResultDistributionChart, AttentionRequiredTable, RecentActivityTimeline, DashboardFilters, type ProjectDashboardStats } from './dashboard';
import { projectsApi, labelsApi, type Label, type ProjectEnvironment } from '../../lib/api';

interface ProjectOverviewTabProps {
  projectId: string;
}

/**
 * プロジェクト概要タブ
 * テスト状況のサマリーを表示
 */
export function ProjectOverviewTab({ projectId }: ProjectOverviewTabProps) {
  const [stats, setStats] = useState<ProjectDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // フィルター用のデータ
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);

  // フィルター状態
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string | undefined>();
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  // 環境とラベル一覧を初回読み込み
  useEffect(() => {
    async function fetchFilterData() {
      try {
        const [envResponse, labelResponse] = await Promise.all([
          projectsApi.getEnvironments(projectId),
          labelsApi.getByProject(projectId),
        ]);
        setEnvironments(envResponse.environments);
        setLabels(labelResponse.labels);
      } catch {
        // フィルターデータ取得失敗は無視（ダッシュボードは表示する）
      }
    }
    fetchFilterData();
  }, [projectId]);

  // ダッシュボードデータを取得
  const fetchDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = selectedEnvironmentId || selectedLabelIds.length > 0
        ? { environmentId: selectedEnvironmentId, labelIds: selectedLabelIds }
        : undefined;

      const response = await projectsApi.getDashboard(projectId, params);
      setStats(response.dashboard);
    } catch {
      setError('ダッシュボードの取得に失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, selectedEnvironmentId, selectedLabelIds]);

  // 初回読み込みとフィルター変更時にデータを取得
  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (isLoading) {
    return (
      <div className="text-foreground-muted">読み込み中...</div>
    );
  }

  if (error || !stats) {
    return (
      <div className="text-danger">{error || 'データの取得に失敗しました'}</div>
    );
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
        <ResultDistributionChart stats={stats} />
        <RecentActivityTimeline stats={stats} className="h-full" />
      </div>

      {/* 要注意テスト一覧 */}
      <AttentionRequiredTable stats={stats} />
    </div>
  );
}
