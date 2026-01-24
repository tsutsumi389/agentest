import { Users, UserPlus, Activity } from 'lucide-react';
import type { AdminDashboardUserStats } from '@agentest/shared';

interface UserStatsCardProps {
  stats: AdminDashboardUserStats;
}

/**
 * ユーザー統計カード
 */
export function UserStatsCard({ stats }: UserStatsCardProps) {
  // プラン分布の割合を計算
  const freePercent = stats.total > 0 ? Math.round((stats.byPlan.free / stats.total) * 100) : 0;
  const proPercent = stats.total > 0 ? Math.round((stats.byPlan.pro / stats.total) * 100) : 0;

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center">
          <Users className="w-5 h-5 text-accent" />
        </div>
      </div>

      <div className="stat-value">{stats.total.toLocaleString()}</div>
      <div className="stat-label">総ユーザー数</div>

      <div className="mt-4 space-y-3">
        {/* プラン分布 */}
        <div>
          <div className="flex justify-between text-xs text-foreground-muted mb-1">
            <span>プラン分布</span>
          </div>
          <div className="h-2 bg-background-tertiary rounded-full overflow-hidden flex">
            <div
              className="h-full bg-foreground-muted"
              style={{ width: `${freePercent}%` }}
              title={`FREE: ${stats.byPlan.free}`}
            />
            <div
              className="h-full bg-accent"
              style={{ width: `${proPercent}%` }}
              title={`PRO: ${stats.byPlan.pro}`}
            />
          </div>
          <div className="flex justify-between text-xs text-foreground-muted mt-1">
            <span>FREE: {stats.byPlan.free}</span>
            <span>PRO: {stats.byPlan.pro}</span>
          </div>
        </div>

        {/* サブ統計 */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-success" />
            <div>
              <div className="text-sm font-medium text-foreground">{stats.newThisMonth}</div>
              <div className="text-xs text-foreground-muted">今月新規</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <div>
              <div className="text-sm font-medium text-foreground">{stats.activeUsers}</div>
              <div className="text-xs text-foreground-muted">アクティブ</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
