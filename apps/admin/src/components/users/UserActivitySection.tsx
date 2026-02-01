import { Clock, Users } from 'lucide-react';
import type { AdminUserDetail } from '@agentest/shared/types';
import { formatRelativeTime } from '../../lib/date-utils';

interface UserActivitySectionProps {
  activity: AdminUserDetail['activity'];
}

/**
 * アクティビティセクション
 */
export function UserActivitySection({ activity }: UserActivitySectionProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg p-4">
      <h2 className="text-sm font-medium text-foreground-muted mb-4">
        アクティビティ
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {/* 最終アクティブ */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
            <Clock className="w-5 h-5 text-foreground-muted" />
          </div>
          <div>
            <p className="text-sm text-foreground-muted">最終アクティブ</p>
            <p className="text-foreground font-medium">
              {formatRelativeTime(activity.lastActiveAt)}
            </p>
          </div>
        </div>

        {/* アクティブセッション数 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-background-tertiary flex items-center justify-center">
            <Users className="w-5 h-5 text-foreground-muted" />
          </div>
          <div>
            <p className="text-sm text-foreground-muted">アクティブセッション</p>
            <p className="text-foreground font-medium">
              {activity.activeSessionCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
