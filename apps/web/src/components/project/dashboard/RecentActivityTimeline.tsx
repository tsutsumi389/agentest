import { Link, useParams } from 'react-router';
import { Play, Pencil, MessageSquare, ChevronRight, History } from 'lucide-react';
import type {
  ProjectDashboardStats,
  RecentActivityItem,
  RecentActivityType,
} from '@agentest/shared';
import { formatRelativeTimeOrDefault, formatDateTime } from '../../../lib/date';

interface RecentActivityTimelineProps {
  stats: ProjectDashboardStats;
  /** 追加のCSSクラス */
  className?: string;
}

/**
 * 活動タイプ別の設定
 */
const ACTIVITY_CONFIG: Record<
  RecentActivityType,
  {
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    iconColor: string;
  }
> = {
  execution: {
    icon: Play,
    bgColor: 'bg-success-subtle',
    iconColor: 'text-success',
  },
  testCaseUpdate: {
    icon: Pencil,
    bgColor: 'bg-accent-subtle',
    iconColor: 'text-accent',
  },
  review: {
    icon: MessageSquare,
    bgColor: 'bg-warning-subtle',
    iconColor: 'text-warning',
  },
};

/**
 * 最近の活動タイムラインコンポーネント
 * プロジェクトの最近のアクティビティをタイムライン形式で表示
 */
export function RecentActivityTimeline({ stats, className }: RecentActivityTimelineProps) {
  const { projectId } = useParams<{ projectId: string }>();

  // projectIdが取得できない場合は何も表示しない
  if (!projectId) {
    return null;
  }

  const { recentActivities } = stats;

  // 活動がない場合は空状態を表示
  if (recentActivities.length === 0) {
    return (
      <div className={`card p-6 flex flex-col ${className ?? ''}`}>
        <h2 className="text-lg font-semibold text-foreground mb-4">最近の活動</h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <History className="w-8 h-8 text-foreground-subtle mx-auto mb-2" />
            <p className="text-foreground-muted">まだ活動がありません</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-6 flex flex-col ${className ?? ''}`}>
      {/* ヘッダー */}
      <h2 className="text-lg font-semibold text-foreground mb-4">最近の活動</h2>

      {/* アクティビティリスト（スクロール対応） */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {recentActivities.map((activity) => (
          <ActivityItem
            key={activity.id}
            activity={activity}
            projectId={projectId}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 活動アイテムコンポーネント
 */
function ActivityItem({
  activity,
  projectId,
}: {
  activity: RecentActivityItem;
  projectId: string;
}) {
  const config = ACTIVITY_CONFIG[activity.type];
  const Icon = config.icon;
  const linkTo = getActivityLink(activity, projectId);
  const dateString = typeof activity.occurredAt === 'string'
    ? activity.occurredAt
    : activity.occurredAt.toISOString();

  return (
    <Link
      to={linkTo}
      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors group"
    >
      {/* アイコン */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center`}
      >
        <Icon className={`w-4 h-4 ${config.iconColor}`} />
      </div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        {/* 説明 */}
        <p className="font-medium text-foreground truncate">{activity.description}</p>

        {/* アクター情報と時間 */}
        <div className="flex items-center gap-2 mt-1 text-sm text-foreground-muted">
          {activity.actor && (
            <>
              {/* アバター */}
              {activity.actor.avatarUrl ? (
                <img
                  src={activity.actor.avatarUrl}
                  alt={activity.actor.name}
                  className="w-4 h-4 rounded-full"
                />
              ) : (
                <div className="w-4 h-4 rounded-full bg-background-tertiary flex items-center justify-center text-xs">
                  {activity.actor.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span>{activity.actor.name}</span>
              <span className="text-foreground-subtle">·</span>
            </>
          )}
          <time
            dateTime={dateString}
            title={formatDateTime(dateString)}
          >
            {formatRelativeTimeOrDefault(activity.occurredAt)}
          </time>
        </div>
      </div>

      {/* 矢印 */}
      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-foreground-muted" />
      </div>
    </Link>
  );
}

/**
 * 活動タイプに応じたリンク先を生成
 */
function getActivityLink(activity: RecentActivityItem, projectId: string): string {
  switch (activity.type) {
    case 'execution':
      return `/executions/${activity.id}`;
    case 'testCaseUpdate':
      if (activity.testSuiteId && activity.testCaseId) {
        return `/projects/${projectId}/test-suites/${activity.testSuiteId}/test-cases/${activity.testCaseId}`;
      }
      return `/projects/${projectId}`;
    case 'review':
      if (activity.testSuiteId) {
        return `/test-suites/${activity.testSuiteId}?tab=reviews`;
      }
      return `/projects/${projectId}`;
    default: {
      // exhaustive check: 新しい活動タイプが追加された場合にコンパイルエラーになる
      const exhaustiveCheck: never = activity.type;
      throw new Error(`Unknown activity type: ${exhaustiveCheck}`);
    }
  }
}
