import { ChevronUp, ChevronDown, ShieldCheck, ShieldX, Eye, Edit, Trash2, Unlock, KeyRound } from 'lucide-react';
import { Link } from 'react-router';
import type {
  SystemAdminListItem,
  SystemAdminSortBy,
  SystemAdminPagination,
} from '@agentest/shared/types';
import { formatDate, formatRelativeTime } from '../../lib/date-utils';
import { SystemAdminRoleBadge } from './SystemAdminRoleBadge';

interface SystemAdminTableProps {
  admins: SystemAdminListItem[];
  pagination: SystemAdminPagination;
  sortBy: SystemAdminSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: SystemAdminSortBy) => void;
  onPageChange: (page: number) => void;
  onEdit?: (admin: SystemAdminListItem) => void;
  onDelete?: (admin: SystemAdminListItem) => void;
  onUnlock?: (admin: SystemAdminListItem) => void;
  onReset2FA?: (admin: SystemAdminListItem) => void;
}

// ============================================
// ヘルパーコンポーネント
// ============================================

interface SortIconProps {
  column: SystemAdminSortBy;
  sortBy: SystemAdminSortBy;
  sortOrder: 'asc' | 'desc';
}

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
  column: SystemAdminSortBy;
  sortBy: SystemAdminSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: SystemAdminSortBy) => void;
  children: React.ReactNode;
}

function SortableHeader({
  column,
  sortBy,
  sortOrder,
  onSort,
  children,
}: SortableHeaderProps) {
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

// ============================================
// メインコンポーネント
// ============================================

/**
 * システム管理者一覧テーブル
 */
export function SystemAdminTable({
  admins,
  pagination,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
  onEdit,
  onDelete,
  onUnlock,
  onReset2FA,
}: SystemAdminTableProps) {
  const startIndex = admins.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

  // ステータス表示
  const getStatusDisplay = (admin: SystemAdminListItem) => {
    if (admin.deletedAt) {
      return <span className="text-xs text-error">削除済み</span>;
    }
    if (admin.lockedUntil && new Date(admin.lockedUntil) > new Date()) {
      return <span className="text-xs text-warning">ロック中</span>;
    }
    return <span className="text-xs text-success">有効</span>;
  };

  return (
    <div className="space-y-4">
      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <SortableHeader
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                名前
              </SortableHeader>
              <SortableHeader
                column="email"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                メール
              </SortableHeader>
              <SortableHeader
                column="role"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                ロール
              </SortableHeader>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                2FA
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                状態
              </th>
              <SortableHeader
                column="createdAt"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                登録日
              </SortableHeader>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-12 text-center text-foreground-muted"
                >
                  管理者が見つかりません
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr
                  key={admin.id}
                  className={`border-b border-border hover:bg-background-secondary ${
                    admin.deletedAt ? 'opacity-50' : ''
                  }`}
                >
                  {/* 名前 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center">
                        <span className="text-sm font-medium text-accent">
                          {admin.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <Link
                        to={`/system-admins/${admin.id}`}
                        className="text-sm font-medium text-foreground hover:text-accent hover:underline"
                      >
                        {admin.name}
                      </Link>
                    </div>
                  </td>

                  {/* メール */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {admin.email}
                  </td>

                  {/* ロール */}
                  <td className="px-4 py-3">
                    <SystemAdminRoleBadge role={admin.role} />
                  </td>

                  {/* 2FA */}
                  <td className="px-4 py-3">
                    {admin.totpEnabled ? (
                      <span title="2FA有効">
                        <ShieldCheck className="w-5 h-5 text-success" aria-label="2FA有効" />
                      </span>
                    ) : (
                      <span title="2FA無効">
                        <ShieldX className="w-5 h-5 text-foreground-muted" aria-label="2FA無効" />
                      </span>
                    )}
                  </td>

                  {/* 状態 */}
                  <td className="px-4 py-3">
                    {getStatusDisplay(admin)}
                  </td>

                  {/* 登録日 */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    <span title={formatDate(admin.createdAt)}>
                      {formatRelativeTime(admin.createdAt)}
                    </span>
                  </td>

                  {/* 操作 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/system-admins/${admin.id}`}
                        className="p-1 text-foreground-muted hover:text-foreground"
                        title="詳細"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      {!admin.deletedAt && (
                        <>
                          {onEdit && (
                            <button
                              onClick={() => onEdit(admin)}
                              className="p-1 text-foreground-muted hover:text-foreground"
                              title="編集"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {admin.lockedUntil && new Date(admin.lockedUntil) > new Date() && onUnlock && (
                            <button
                              onClick={() => onUnlock(admin)}
                              className="p-1 text-foreground-muted hover:text-warning"
                              title="ロック解除"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}
                          {admin.totpEnabled && onReset2FA && (
                            <button
                              onClick={() => onReset2FA(admin)}
                              className="p-1 text-foreground-muted hover:text-accent"
                              title="2FAリセット"
                            >
                              <KeyRound className="w-4 h-4" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(admin)}
                              className="p-1 text-foreground-muted hover:text-error"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
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
