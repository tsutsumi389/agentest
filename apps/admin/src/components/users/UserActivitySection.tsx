import { Clock, Users } from 'lucide-react';
import type { AdminUserDetail } from '@agentest/shared';

interface UserActivitySectionProps {
  activity: AdminUserDetail['activity'];
}

/**
 * 相対時間をフォーマット
 */
function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return 'たった今';
  if (diffMinutes < 60) return `${diffMinutes}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  return new Date(isoString).toLocaleDateString('ja-JP');
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
