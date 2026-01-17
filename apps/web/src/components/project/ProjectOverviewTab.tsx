import { useEffect, useState } from 'react';
import { KpiSummaryCards, type ProjectDashboardStats } from './dashboard';

// TODO: APIエンドポイント実装後に projectsApi.getDashboard を使用する
// import { projectsApi } from '../../lib/api';

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

  useEffect(() => {
    async function fetchDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        // TODO: APIエンドポイント実装後に以下に置き換え
        // const data = await projectsApi.getDashboard(projectId);
        // setStats(data);

        // 開発用モックデータ（API実装後は削除）
        const mockStats: ProjectDashboardStats = {
          summary: {
            totalTestCases: 42,
            lastExecutionAt: new Date(Date.now() - 3600000), // 1時間前
            overallPassRate: 85,
            inProgressExecutions: 2,
          },
        };
        setStats(mockStats);
      } catch {
        setError('ダッシュボードの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboard();
  }, [projectId]);

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
      {/* KPIサマリーカード */}
      <KpiSummaryCards stats={stats} />

      {/* 以下、他のダッシュボードコンポーネント（別タスクで実装予定） */}
      {/* <ResultDistributionChart stats={stats} /> */}
      {/* <AttentionRequiredTable stats={stats} /> */}
      {/* <RecentActivityTimeline stats={stats} /> */}
      {/* <SuiteCoverageList stats={stats} /> */}
    </div>
  );
}
