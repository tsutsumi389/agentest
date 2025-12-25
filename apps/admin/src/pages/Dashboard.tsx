import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Play,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
} from 'lucide-react';

/**
 * 管理ダッシュボードページ
 */
export function Dashboard() {
  // 統計情報を取得（モック）
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      // TODO: 実際のAPI呼び出しに置き換え
      return {
        users: { total: 156, change: 12 },
        projects: { total: 48, change: 5 },
        testSuites: { total: 234, change: 18 },
        executions: { total: 1289, change: -3 },
        passRate: 94.2,
        activeExecutions: 3,
      };
    },
  });

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
          <div>
            <h1 className="text-2xl font-bold text-foreground">ダッシュボード</h1>
            <p className="text-foreground-muted mt-1">
              システム全体の統計情報
            </p>
          </div>

          {isLoading ? (
            <div className="text-center text-foreground-muted py-12">
              読み込み中...
            </div>
          ) : (
            <>
              {/* 統計カード */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  icon={Users}
                  label="ユーザー数"
                  value={stats?.users.total || 0}
                  change={stats?.users.change || 0}
                />
                <StatCard
                  icon={FolderKanban}
                  label="プロジェクト数"
                  value={stats?.projects.total || 0}
                  change={stats?.projects.change || 0}
                />
                <StatCard
                  icon={FileText}
                  label="テストスイート数"
                  value={stats?.testSuites.total || 0}
                  change={stats?.testSuites.change || 0}
                />
                <StatCard
                  icon={Play}
                  label="実行回数（今月）"
                  value={stats?.executions.total || 0}
                  change={stats?.executions.change || 0}
                />
              </div>

              {/* 追加の統計 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* テスト成功率 */}
                <div className="stat-card">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle2 className="w-5 h-5 text-success" />
                    <span className="font-medium text-foreground">テスト成功率</span>
                  </div>
                  <div className="stat-value text-success">
                    {stats?.passRate || 0}%
                  </div>
                  <div className="mt-4 h-2 bg-background-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full transition-all"
                      style={{ width: `${stats?.passRate || 0}%` }}
                    />
                  </div>
                </div>

                {/* 実行中のテスト */}
                <div className="stat-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-warning" />
                    <span className="font-medium text-foreground">実行中のテスト</span>
                  </div>
                  <div className="stat-value text-warning">
                    {stats?.activeExecutions || 0}
                  </div>
                  <p className="text-sm text-foreground-muted mt-2">
                    現在実行中のテストスイート
                  </p>
                </div>

                {/* クイックアクション */}
                <div className="stat-card">
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-accent" />
                    <span className="font-medium text-foreground">クイックアクション</span>
                  </div>
                  <div className="space-y-2">
                    <button className="btn btn-secondary w-full justify-start">
                      <Users className="w-4 h-4" />
                      ユーザー管理
                    </button>
                    <button className="btn btn-secondary w-full justify-start">
                      <FolderKanban className="w-4 h-4" />
                      プロジェクト一覧
                    </button>
                  </div>
                </div>
              </div>

              {/* 最近のアクティビティ（プレースホルダー） */}
              <div className="card">
                <div className="p-4 border-b border-border">
                  <h2 className="font-semibold text-foreground">最近のアクティビティ</h2>
                </div>
                <div className="p-8 text-center text-foreground-muted">
                  アクティビティログは近日公開予定です
                </div>
              </div>
            </>
          )}
        </div>
      </main>
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
  change,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  change: number;
}) {
  const isPositive = change >= 0;

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-success' : 'text-danger'}`}>
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{isPositive ? '+' : ''}{change}</span>
        </div>
      </div>
      <div className="stat-value">{value.toLocaleString()}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
