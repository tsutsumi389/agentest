import { ChevronUp, ChevronDown, Building2, FolderKanban } from 'lucide-react';
import { Link } from 'react-router';
import type {
  AdminUserListItem,
  AdminUserSortBy,
  AdminUserPagination,
} from '@agentest/shared';
import { formatDate, formatRelativeTime } from '../../lib/date-utils';
import { PlanBadge } from '../common';

interface UserTableProps {
  users: AdminUserListItem[];
  pagination: AdminUserPagination;
  sortBy: AdminUserSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: AdminUserSortBy) => void;
  onPageChange: (page: number) => void;
}

// ============================================
// ヘルパーコンポーネント（外部定義で再作成を防止）
// ============================================

interface SortIconProps {
  column: AdminUserSortBy;
  sortBy: AdminUserSortBy;
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
  column: AdminUserSortBy;
  sortBy: AdminUserSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: AdminUserSortBy) => void;
  children: React.ReactNode;
}

/**
 * ソート可能なテーブルヘッダー
 */
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
 * ユーザー一覧テーブル
 */
export function UserTable({
  users,
  pagination,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
}: UserTableProps) {
  // 表示範囲の計算
  const startIndex = users.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);

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
                ユーザー
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
                column="plan"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={onSort}
              >
                プラン
              </SortableHeader>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                統計
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
                最終アクティブ
              </th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-foreground-muted"
                >
                  ユーザーが見つかりません
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className={`border-b border-border hover:bg-background-secondary ${
                    user.deletedAt ? 'opacity-50' : ''
                  }`}
                >
                  {/* ユーザー情報 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center">
                          <span className="text-sm font-medium text-accent">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <Link
                          to={`/users/${user.id}`}
                          className="text-sm font-medium text-foreground hover:text-accent hover:underline"
                        >
                          {user.name}
                        </Link>
                        {user.deletedAt && (
                          <span className="ml-2 text-xs text-error">削除済み</span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* メール */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {user.email}
                  </td>

                  {/* プラン */}
                  <td className="px-4 py-3">
                    <PlanBadge plan={user.plan} />
                  </td>

                  {/* 統計 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4 text-sm text-foreground-muted">
                      <div className="flex items-center gap-1" title="所属組織数">
                        <Building2 className="w-4 h-4" />
                        <span>{user.stats.organizationCount}</span>
                      </div>
                      <div className="flex items-center gap-1" title="所有プロジェクト数">
                        <FolderKanban className="w-4 h-4" />
                        <span>{user.stats.projectCount}</span>
                      </div>
                    </div>
                  </td>

                  {/* 登録日 */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatDate(user.createdAt)}
                  </td>

                  {/* 最終アクティブ */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatRelativeTime(user.stats.lastActiveAt)}
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
