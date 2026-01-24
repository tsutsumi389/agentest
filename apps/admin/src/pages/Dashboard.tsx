import {
  LayoutDashboard,
  RefreshCw,
} from 'lucide-react';
import { useAdminDashboard } from '../hooks/useAdminDashboard';
import {
  SystemHealthCard,
  UserStatsCard,
  OrgStatsCard,
  ExecutionStatsCard,
  RevenueStatsCard,
} from '../components/dashboard';

/**
 * 管理ダッシュボードページ
 */
export function Dashboard() {
  const { data: stats, isLoading, refetch, isFetching } = useAdminDashboard();

  // 最終更新時刻をフォーマット
  const formatFetchedAt = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="bg-background-secondary border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <LayoutDashboard className="w-6 h-6 text-accent" />
              <span className="text-lg font-semibold text-foreground">
                Agentest Admin
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-foreground-muted">
                管理者ダッシュボード
              </span>
              <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center">
                <span className="text-sm font-medium text-accent">A</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* タイトル */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
              <p className="text-foreground-muted mt-1">
                システム全体の統計情報
              </p>
            </div>
            <div className="flex items-center gap-4">
              {stats?.fetchedAt && (
                <span className="text-sm text-foreground-muted">
                  最終更新: {formatFetchedAt(stats.fetchedAt)}
                </span>
              )}
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                className="btn btn-secondary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                更新
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center text-foreground-muted py-12">
              読み込み中...
            </div>
          ) : stats ? (
            <>
              {/* システムヘルス */}
              <SystemHealthCard health={stats.systemHealth} />

              {/* 統計カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <UserStatsCard stats={stats.users} />
                <OrgStatsCard stats={stats.organizations} />
                <ExecutionStatsCard stats={stats.executions} />
                <RevenueStatsCard stats={stats.revenue} />
              </div>
            </>
          ) : (
            <div className="text-center text-foreground-muted py-12">
              データを取得できませんでした
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
