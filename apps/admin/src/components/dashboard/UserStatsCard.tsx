import { Users, UserPlus, Activity } from 'lucide-react';
import type { AdminDashboardUserStats } from '@agentest/shared/types';

interface UserStatsCardProps {
  stats: AdminDashboardUserStats;
}

/**
 * ユーザー統計カード
 */
export function UserStatsCard({ stats }: UserStatsCardProps) {
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
