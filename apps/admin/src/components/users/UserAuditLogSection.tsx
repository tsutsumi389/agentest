import type { AdminUserAuditLogEntry } from '@agentest/shared';

interface UserAuditLogSectionProps {
  logs: AdminUserAuditLogEntry[];
}

/**
 * 相対時間をフォーマット
 */
function formatRelativeTime(isoString: string): string {
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
  return date.toLocaleDateString('ja-JP');
}

/**
 * カテゴリバッジ
 */
function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-background-tertiary text-foreground-muted">
      {category}
    </span>
  );
}

/**
 * 監査ログセクション
 */
export function UserAuditLogSection({ logs }: UserAuditLogSectionProps) {
  return (
    <div className="bg-background-secondary border border-border rounded-lg">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-medium text-foreground">
          監査ログ（最新10件）
        </h2>
      </div>
      {logs.length === 0 ? (
        <div className="px-4 py-8 text-center text-foreground-muted">
          監査ログはありません
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  日時
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  カテゴリ
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  アクション
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  対象
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                  IPアドレス
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-border last:border-b-0 hover:bg-background-tertiary"
                >
                  <td className="px-4 py-3 text-sm text-foreground-muted whitespace-nowrap">
                    {formatRelativeTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={log.category} />
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {log.action}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground-muted font-mono text-xs">
                    {log.targetType && log.targetId ? (
                      <>
                        {log.targetType}:{log.targetId.substring(0, 8)}...
                      </>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground-muted font-mono">
                    {log.ipAddress || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
