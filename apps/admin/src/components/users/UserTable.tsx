import { ChevronUp, ChevronDown, Building2, FolderKanban } from 'lucide-react';
import { Link } from 'react-router';
import type {
  AdminUserListItem,
  AdminUserSortBy,
  AdminUserPagination,
} from '@agentest/shared';

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

interface PlanBadgeProps {
  plan: 'FREE' | 'PRO';
}

/**
 * プランバッジ
 */
function PlanBadge({ plan }: PlanBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 text-xs font-medium rounded ${
        plan === 'PRO'
          ? 'bg-accent-muted text-accent'
          : 'bg-background-tertiary text-foreground-muted'
      }`}
    >
      {plan}
    </span>
  );
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * 日付をフォーマット
 */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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

  if (diffDays === 0) return '今日';
  if (diffDays === 1) return '昨日';
  if (diffDays < 7) return `${diffDays}日前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;
  return formatDate(isoString);
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
