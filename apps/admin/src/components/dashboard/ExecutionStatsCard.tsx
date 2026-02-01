import { Play, CheckCircle2, XCircle } from 'lucide-react';
import type { AdminDashboardExecutionStats } from '@agentest/shared/types';

interface ExecutionStatsCardProps {
  stats: AdminDashboardExecutionStats;
}

/**
 * テスト実行統計カード
 */
export function ExecutionStatsCard({ stats }: ExecutionStatsCardProps) {
  // 成功率に応じた色を決定
  const passRateColor =
    stats.passRate >= 90 ? 'text-success' :
    stats.passRate >= 70 ? 'text-warning' :
    'text-danger';

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
          <Play className="w-5 h-5 text-accent" />
        </div>
      </div>

      <div className="stat-value">{stats.totalThisMonth.toLocaleString()}</div>
      <div className="stat-label">今月の実行数</div>

      <div className="mt-4 space-y-3">
        {/* 成功率 */}
        <div>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-foreground-muted">成功率</span>
            <span className={`text-lg font-bold ${passRateColor}`}>{stats.passRate}%</span>
          </div>
          <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                stats.passRate >= 90 ? 'bg-success' :
                stats.passRate >= 70 ? 'bg-warning' :
                'bg-danger'
              }`}
              style={{ width: `${stats.passRate}%` }}
            />
          </div>
        </div>

        {/* サブ統計 */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <div>
              <div className="text-sm font-medium text-foreground">{stats.passCount.toLocaleString()}</div>
              <div className="text-xs text-foreground-muted">成功</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-danger" />
            <div>
              <div className="text-sm font-medium text-foreground">{stats.failCount.toLocaleString()}</div>
              <div className="text-xs text-foreground-muted">失敗</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
