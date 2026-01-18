import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  FolderKanban,
  FileText,
  Play,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Plus,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { usersApi, type DashboardStats } from '../lib/api';
import { usePageSidebar } from '../components/Layout';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ProgressBar } from '../components/ui/ProgressBar';

/**
 * 相対時間をフォーマット
 */
function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return '数秒前';
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;

  return date.toLocaleDateString('ja-JP');
}

/**
 * 実行サマリーからStatusBadge用ステータスを決定
 * テスト失敗がある場合はfailed、全てパスならpassed、まだ結果があるならrunning
 */
function mapExecutionStatus(
  summary: { passed: number; failed: number; pending: number; total: number }
): 'passed' | 'failed' | 'running' | 'pending' {
  if (summary.failed > 0) return 'failed';
  if (summary.pending > 0) return 'running';
  if (summary.passed > 0 && summary.total === summary.passed) return 'passed';
  return 'pending';
}

/**
 * ダッシュボードページ
 */
export function DashboardPage() {
  const { user } = useAuthStore();
  const { setSidebarContent } = usePageSidebar();

  // ダッシュボード統計を取得
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    isError: dashboardError,
  } = useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: () => usersApi.getDashboardStats(user!.id),
    enabled: !!user?.id,
    staleTime: 30 * 1000, // 30秒間キャッシュ
  });

  // プロジェクト一覧を取得（サイドバー用）
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['user-projects', user?.id],
    queryFn: () => usersApi.getProjects(user!.id),
    enabled: !!user?.id,
  });

  const projects = projectsData?.projects || [];
  const isLoading = dashboardLoading || projectsLoading;

  // サイドバーコンテンツを設定
  useEffect(() => {
    setSidebarContent(
      <DashboardSidebar
        projects={projects}
        executions={dashboardData?.executions}
      />
    );
    return () => setSidebarContent(null);
  }, [setSidebarContent, projects, dashboardData?.executions]);

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          おかえりなさい、{user?.name}
        </h1>
        <p className="text-foreground-muted mt-1">
          プロジェクトの状況を確認しましょう
        </p>
      </div>

      {/* エラー表示 */}
      {dashboardError && (
        <div className="card p-4 border-danger/30 bg-danger-subtle/10">
          <p className="text-sm text-danger">
            統計情報の取得に失敗しました。ページを再読み込みしてください。
          </p>
        </div>
      )}

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          icon={FolderKanban}
          label="プロジェクト"
          value={dashboardData?.projects.total ?? '-'}
          color="accent"
          isLoading={dashboardLoading}
        />
        <StatCard
          icon={FileText}
          label="テストスイート"
          value={dashboardData?.projects.testSuites ?? '-'}
          color="accent"
          isLoading={dashboardLoading}
        />
        <StatCard
          icon={CheckCircle2}
          label="成功"
          value={dashboardData?.executions.passed ?? '-'}
          color="success"
          isLoading={dashboardLoading}
        />
        <StatCard
          icon={XCircle}
          label="失敗"
          value={dashboardData?.executions.failed ?? '-'}
          color="danger"
          isLoading={dashboardLoading}
        />
      </div>

      {/* 最近のプロジェクト */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">最近のプロジェクト</h2>
          <Link
            to="/projects"
            className="text-sm text-accent hover:text-accent-hover flex items-center gap-1"
          >
            すべて表示
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-foreground-muted">
            読み込み中...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8 text-center">
            <FolderKanban className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
            <p className="text-foreground-muted mb-4">
              プロジェクトがありません
            </p>
            <Link to="/projects" className="btn btn-primary">
              プロジェクトを作成
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {projects.slice(0, 5).map((project) => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="flex items-center justify-between p-4 hover:bg-background-tertiary transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded bg-accent-subtle flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{project.name}</p>
                    <p className="text-sm text-foreground-muted">
                      {project._count?.testSuites || 0} テストスイート
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-foreground-subtle" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 最近の実行 */}
      <div className="card">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">最近の実行</h2>
          <Link
            to="/executions"
            className="text-sm text-accent hover:text-accent-hover flex items-center gap-1"
          >
            すべて表示
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {dashboardLoading ? (
          <div className="p-8 text-center text-foreground-muted">
            読み込み中...
          </div>
        ) : !dashboardData?.recentExecutions.length ? (
          <div className="p-8 text-center">
            <Play className="w-12 h-12 text-foreground-subtle mx-auto mb-3" />
            <p className="text-foreground-muted">
              最近の実行はありません
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {dashboardData.recentExecutions.map((exec) => (
              <Link
                key={exec.id}
                to={`/executions/${exec.id}`}
                className="flex items-center justify-between p-4 hover:bg-background-tertiary transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <StatusBadge status={mapExecutionStatus(exec.summary)} showLabel={false} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">
                      {exec.testSuiteName}
                    </p>
                    <p className="text-sm text-foreground-muted">
                      {exec.projectName} • {formatRelativeTime(exec.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="w-32 ml-4">
                  <ProgressBar
                    passed={exec.summary.passed}
                    failed={exec.summary.failed}
                    skipped={exec.summary.pending}
                    total={exec.summary.total}
                    size="sm"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ダッシュボード用サイドバー
 */
function DashboardSidebar({
  projects,
  executions,
}: {
  projects: { id: string; name: string }[];
  executions?: DashboardStats['executions'];
}) {
  return (
    <div className="h-full flex flex-col">
      {/* クイックアクション */}
      <div className="p-4 border-b border-border">
        <h3 className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
          クイックアクション
        </h3>
        <div className="space-y-1">
          <Link
            to="/projects"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            新規プロジェクト
          </Link>
          <Link
            to="/executions"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-md transition-colors"
          >
            <Play className="w-4 h-4" />
            テスト実行
          </Link>
        </div>
      </div>

      {/* 最近のプロジェクト */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h3 className="text-xs font-medium text-foreground-muted uppercase tracking-wider mb-3">
          最近のプロジェクト
        </h3>
        <div className="space-y-1">
          {projects.slice(0, 8).map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:text-foreground hover:bg-background-tertiary rounded-md transition-colors"
            >
              <FolderKanban className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{project.name}</span>
            </Link>
          ))}
          {projects.length === 0 && (
            <p className="px-3 py-2 text-sm text-foreground-muted">
              プロジェクトがありません
            </p>
          )}
        </div>
      </div>

      {/* サマリー */}
      <div className="p-4 border-t border-border bg-background-tertiary/50">
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>今週のテスト: {executions?.weeklyCount ?? 0}回</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground-muted mt-1">
          <Clock className="w-3.5 h-3.5" />
          <span>最終実行: {formatRelativeTime(executions?.lastExecutedAt ?? null)}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * 統計カードコンポーネント
 */
function StatCard({
  icon: Icon,
  label,
  value,
  color,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  color: 'accent' | 'success' | 'danger';
  isLoading?: boolean;
}) {
  // ガイドライン準拠: subtle背景を使用
  const colorClasses = {
    accent: 'bg-accent-subtle text-accent',
    success: 'bg-success-subtle text-success',
    danger: 'bg-danger-subtle text-danger',
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          {isLoading ? (
            <div className="h-8 w-12 bg-background-tertiary animate-pulse rounded" />
          ) : (
            <p className="text-2xl font-bold text-foreground">{value}</p>
          )}
          <p className="text-sm text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}
