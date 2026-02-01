import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ClipboardList, RefreshCw } from 'lucide-react';
import type {
  AdminAuditLogSearchParams,
  AdminAuditLogSortBy,
  AdminAuditLogCategory,
  AdminAuditLogEntry,
} from '@agentest/shared/types';
import { useAdminAuditLogs } from '../hooks/useAdminAuditLogs';
import {
  AuditLogTable,
  AuditLogSearchForm,
  AuditLogFilters,
  AuditLogDetailModal,
} from '../components/audit-logs';

/**
 * 監査ログ一覧ページ
 */
export function AuditLogs() {
  // URLSearchParams を使って検索条件を管理
  const [searchParams, setSearchParams] = useSearchParams();

  // 詳細モーダル用の状態
  const [selectedLog, setSelectedLog] = useState<AdminAuditLogEntry | null>(null);

  // 検索パラメータを取得
  const params: AdminAuditLogSearchParams = {
    q: searchParams.get('q') || undefined,
    category: searchParams.get('category')
      ? (searchParams.get('category')!.split(',') as AdminAuditLogCategory[])
      : undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    userId: searchParams.get('userId') || undefined,
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 50,
    sortBy: (searchParams.get('sortBy') as AdminAuditLogSortBy) || 'createdAt',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
  };

  // データ取得
  const { data, isLoading, isFetching, refetch } = useAdminAuditLogs(params);

  // パラメータ更新ヘルパー
  const updateParams = useCallback(
    (updates: Partial<AdminAuditLogSearchParams>) => {
      const newParams = new URLSearchParams(searchParams);

      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
          newParams.delete(key);
        } else if (Array.isArray(value)) {
          newParams.set(key, value.join(','));
        } else {
          newParams.set(key, String(value));
        }
      });

      // ページをリセット（検索条件変更時）
      if (!('page' in updates)) {
        newParams.delete('page');
      }

      setSearchParams(newParams);
    },
    [searchParams, setSearchParams]
  );

  // ソート処理
  const handleSort = (sortBy: AdminAuditLogSortBy) => {
    if (params.sortBy === sortBy) {
      // 同じカラムの場合は順序を反転
      updateParams({
        sortOrder: params.sortOrder === 'asc' ? 'desc' : 'asc',
        page: 1,
      });
    } else {
      // 別カラムの場合はdescでソート
      updateParams({ sortBy, sortOrder: 'desc', page: 1 });
    }
  };

  // フィルタークリア
  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  // 詳細表示
  const handleViewDetails = (log: AdminAuditLogEntry) => {
    setSelectedLog(log);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setSelectedLog(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-6">
        {/* タイトル */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-6 h-6 text-accent" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">監査ログ</h1>
              <p className="text-foreground-muted mt-1">
                システム全体の操作履歴を閲覧
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn btn-secondary flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            更新
          </button>
        </div>

        {/* 検索・フィルター */}
        <div className="bg-background-secondary border border-border rounded-lg p-4 space-y-4">
          <AuditLogSearchForm
            value={params.q || ''}
            onChange={(q) => updateParams({ q })}
          />
          <AuditLogFilters
            category={params.category || []}
            organizationId={params.organizationId || ''}
            userId={params.userId || ''}
            startDate={params.startDate || ''}
            endDate={params.endDate || ''}
            onCategoryChange={(category) => updateParams({ category })}
            onOrganizationIdChange={(organizationId) => updateParams({ organizationId })}
            onUserIdChange={(userId) => updateParams({ userId })}
            onStartDateChange={(startDate) => updateParams({ startDate })}
            onEndDateChange={(endDate) => updateParams({ endDate })}
            onClear={handleClearFilters}
          />
        </div>

        {/* テーブル */}
        <div className="bg-background-secondary border border-border rounded-lg">
          {isLoading ? (
            <div className="text-center text-foreground-muted py-12">
              読み込み中...
            </div>
          ) : data ? (
            <AuditLogTable
              auditLogs={data.auditLogs}
              pagination={data.pagination}
              sortBy={params.sortBy || 'createdAt'}
              sortOrder={params.sortOrder || 'desc'}
              onSort={handleSort}
              onPageChange={(page) => updateParams({ page })}
              onViewDetails={handleViewDetails}
            />
          ) : (
            <div className="text-center text-foreground-muted py-12">
              データを取得できませんでした
            </div>
          )}
        </div>
      </div>

      {/* 詳細モーダル */}
      {selectedLog && (
        <AuditLogDetailModal log={selectedLog} onClose={handleCloseModal} />
      )}
    </div>
  );
}
