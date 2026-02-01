import { Link } from 'react-router';
import { ChevronUp, ChevronDown, Users, FolderKanban } from 'lucide-react';
import type {
  AdminOrganizationListItem,
  AdminOrganizationSortBy,
  AdminOrganizationPagination,
} from '@agentest/shared/types';
import { formatDate } from '../../lib/date-utils';
import { OrganizationPlanBadge } from '../common';

interface OrganizationTableProps {
  organizations: AdminOrganizationListItem[];
  pagination: AdminOrganizationPagination;
  sortBy: AdminOrganizationSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: AdminOrganizationSortBy) => void;
  onPageChange: (page: number) => void;
}

// ============================================
// ヘルパーコンポーネント（外部定義で再作成を防止）
// ============================================

interface SortIconProps {
  column: AdminOrganizationSortBy;
  sortBy: AdminOrganizationSortBy;
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
  column: AdminOrganizationSortBy;
  sortBy: AdminOrganizationSortBy;
  sortOrder: 'asc' | 'desc';
  onSort: (sortBy: AdminOrganizationSortBy) => void;
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
 * 組織一覧テーブル
 */
export function OrganizationTable({
  organizations,
  pagination,
  sortBy,
  sortOrder,
  onSort,
  onPageChange,
}: OrganizationTableProps) {
  // 表示範囲の計算
  const startIndex = organizations.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0;
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
                組織
              </SortableHeader>
              <th className="px-4 py-3 text-left text-sm font-medium text-foreground-muted">
                オーナー
              </th>
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
            </tr>
          </thead>
          <tbody>
            {organizations.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-foreground-muted"
                >
                  組織が見つかりません
                </td>
              </tr>
            ) : (
              organizations.map((org) => (
                <tr
                  key={org.id}
                  className={`border-b border-border hover:bg-background-secondary ${
                    org.deletedAt ? 'opacity-50' : ''
                  }`}
                >
                  {/* 組織情報 */}
                  <td className="px-4 py-3">
                    <Link
                      to={`/organizations/${org.id}`}
                      className="flex items-center gap-3 hover:opacity-80"
                    >
                      {org.avatarUrl ? (
                        <img
                          src={org.avatarUrl}
                          alt={org.name}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-accent-muted flex items-center justify-center">
                          <span className="text-sm font-medium text-accent">
                            {org.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground hover:text-accent">
                            {org.name}
                          </span>
                          {org.deletedAt && (
                            <span className="text-xs text-error">削除済み</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </td>

                  {/* オーナー */}
                  <td className="px-4 py-3">
                    {org.owner ? (
                      <div className="flex items-center gap-2">
                        {org.owner.avatarUrl ? (
                          <img
                            src={org.owner.avatarUrl}
                            alt={org.owner.name}
                            className="w-6 h-6 rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center">
                            <span className="text-xs font-medium text-foreground-muted">
                              {org.owner.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="text-sm text-foreground">{org.owner.name}</div>
                          <div className="text-xs text-foreground-muted">{org.owner.email}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-foreground-muted">-</span>
                    )}
                  </td>

                  {/* プラン */}
                  <td className="px-4 py-3">
                    <OrganizationPlanBadge plan={org.plan} />
                  </td>

                  {/* 統計 */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-4 text-sm text-foreground-muted">
                      <div className="flex items-center gap-1" title="メンバー数">
                        <Users className="w-4 h-4" />
                        <span>{org.stats.memberCount}</span>
                      </div>
                      <div className="flex items-center gap-1" title="プロジェクト数">
                        <FolderKanban className="w-4 h-4" />
                        <span>{org.stats.projectCount}</span>
                      </div>
                    </div>
                  </td>

                  {/* 登録日 */}
                  <td className="px-4 py-3 text-sm text-foreground-muted">
                    {formatDate(org.createdAt)}
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
