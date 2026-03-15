import { Link } from 'react-router';
import { ChevronUp, ChevronDown, Eye } from 'lucide-react';
import type {
  AdminAuditLogEntry,
  AdminAuditLogSortBy,
  AdminAuditLogPagination,
  AdminAuditLogCategory,
} from '@agentest/shared/types';
import { formatRelativeTime } from '../../lib/date-utils';
import { CATEGORY_LABELS } from '../../lib/audit-log-utils';

interface AuditLogTableProps {
  auditLogs: AdminAuditLogEntry[];
  pagination: AdminAuditLogPagination;
  sortBy: AdminAuditLogSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: AdminAuditLogSortBy) => void;
  onPageChange: (page: number) => void;
  onViewDetails: (log: AdminAuditLogEntry) => void;
}

// ============================================
// ヘルパーコンポーネント
// ============================================

interface SortIconProps {
  column: AdminAuditLogSortBy;
  sortBy: AdminAuditLogSortBy;
  sortOrder: 'asc' | 'desc';
}

/**
 * ソートアイコン
 */
function SortIcon({ column, sortBy, sortOrder }: SortIconProps) {
  if (sortBy !== column) {
    return <ChevronUp className="w-4 h-4 opacity-30" />;
  }
  return sortOrder === 'asc' ? (
    <ChevronUp className="w-4 h-4" />
  ) : (
    <ChevronDown className="w-4 h-4" />
  );
}

interface SortableHeaderProps {
  column: AdminAuditLogSortBy;
  sortBy: AdminAuditLogSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: AdminAuditLogSortBy) => void;
  children: React.ReactNode;
}

/**
 * ソート可能なテーブルヘッダー
 */
function SortableHeader({ column, sortBy, sortOrder, onSort, children }: SortableHeaderProps) {
  return (
    <th
      className="px-4 py-3 text-left text-sm font-medium text-foreground-muted cursor-pointer hover:text-foreground select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon column={column} sortBy={sortBy} sortOrder={sortOrder} />
      </div>
    </th>
  );
}

/**
 * カテゴリバッジ
 */
function CategoryBadge({ category }: { category: AdminAuditLogCategory }) {
  return (
    <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-background-tertiary text-foreground-muted">
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

// ============================================
// メインコンポーネント
// ============================================

/**
 * 監査ログ一覧テーブル
 */
export function AuditLogTable({
  auditLogs,
  pagination,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onViewDetails,
}: AuditLogTableProps) {
  // 表示範囲の計算
  const startIndex = auditLogs.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="space-y-4">
      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <SortableHeader
                column="createdAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                日時
              </SortableHeader>
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
                組織
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                ユーザー
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">IP</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                詳細
              </th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-foreground-muted">
                  監査ログが見つかりません
                </td>
              </tr>
            ) : (
              auditLogs.map((log) => (
                <tr key={log.id} className="border-b border-border hover:bg-background-secondary">
                  {/* 日時 */}
                  <td className="px-4 py-3 text-sm text-foreground-muted whitespace-nowrap">
                    {formatRelativeTime(log.createdAt)}
                  </td>

                  {/* カテゴリ */}
                  <td className="px-4 py-3">
                    <CategoryBadge category={log.category} />
                  </td>

                  {/* アクション */}
                  <td className="px-4 py-3 text-sm text-foreground">{log.action}</td>

                  {/* 対象 */}
                  <td className="px-4 py-3 text-sm text-foreground-muted font-mono text-xs">
                    {log.targetType && log.targetId ? (
                      <>
                        {log.targetType}:{log.targetId.substring(0, 8)}...
                      </>
                    ) : (
                      '-'
                    )}
                  </td>

                  {/* 組織 */}
                  <td className="px-4 py-3">
                    {log.organization ? (
                      <Link
                        to={`/organizations/${log.organization.id}`}
                        className="text-sm text-accent hover:underline"
                      >
                        {log.organization.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-foreground-muted">-</span>
                    )}
                  </td>

                  {/* ユーザー */}
                  <td className="px-4 py-3">
                    {log.user ? (
                      <Link to={`/users/${log.user.id}`} className="flex items-center gap-2">
                        {log.user.avatarUrl ? (
                          <img
                            src={log.user.avatarUrl}
                            alt={log.user.name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center">
                            <span className="text-xs font-medium text-foreground-muted">
                              {log.user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <span className="text-sm text-accent hover:underline">{log.user.name}</span>
                      </Link>
                    ) : (
                      <span className="text-sm text-foreground-muted">-</span>
                    )}
                  </td>

                  {/* IPアドレス */}
                  <td className="px-4 py-3 text-sm text-foreground-muted font-mono text-xs">
                    {log.ipAddress || '-'}
                  </td>

                  {/* 詳細ボタン */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onViewDetails(log)}
                      className="p-1 text-foreground-muted hover:text-foreground rounded hover:bg-background-tertiary"
                      title="詳細を表示"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* フッター: 件数表示 + ページネーション */}
      <div className="flex items-center justify-between px-4">
        <div className="text-sm text-foreground-muted">
          {pagination.total === 0
            ? '0件'
            : `${pagination.total}件中 ${startIndex}-${endIndex}件を表示`}
        </div>
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50"
            >
              前へ
            </button>
            <span className="text-sm text-foreground-muted">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="btn btn-secondary px-3 py-1 text-sm disabled:opacity-50"
            >
              次へ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
