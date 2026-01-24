import { ChevronUp, ChevronDown, Building2, FolderKanban } from 'lucide-react';
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
  // ソートアイコンを表示
  const SortIcon = ({ column }: { column: AdminUserSortBy }) => {
    if (sortBy !== column) {
      return <ChevronUp className="w-4 h-4 opacity-30" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  // ソート可能なヘッダー
  const SortableHeader = ({
    column,
    children,
  }: {
    column: AdminUserSortBy;
    children: React.ReactNode;
  }) => (
    <th
      className="px-4 py-3 text-left text-sm font-medium text-foreground-muted cursor-pointer hover:text-foreground select-none"
      onClick={() => onSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon column={column} />
      </div>
    </th>
  );

  // 日付をフォーマット
  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 相対時間をフォーマット
  const formatRelativeTime = (isoString: string | null) => {
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
  };

  // プランバッジ
  const PlanBadge = ({ plan }: { plan: 'FREE' | 'PRO' }) => (
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

  return (
    <div className="space-y-4">
      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <SortableHeader column="name">ユーザー</SortableHeader>
              <SortableHeader column="email">メール</SortableHeader>
              <SortableHeader column="plan">プラン</SortableHeader>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                統計
              </th>
              <SortableHeader column="createdAt">登録日</SortableHeader>
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
                        <div className="text-sm font-medium text-foreground">
                          {user.name}
                          {user.deletedAt && (
                            <span className="ml-2 text-xs text-error">削除済み</span>
                          )}
                        </div>
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

      {/* ページネーション */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4">
          <div className="text-sm text-foreground-muted">
            {pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
          </div>
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
        </div>
      )}
    </div>
  );
}
