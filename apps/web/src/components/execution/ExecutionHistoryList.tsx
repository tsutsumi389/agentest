import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router';
import { Loader2, ChevronLeft, ChevronRight, Calendar, User, X, Server } from 'lucide-react';
import {
  testSuitesApi,
  projectsApi,
  ApiError,
  type Execution,
  type ExecutionSearchParams,
  type ProjectEnvironment,
} from '../../lib/api';
import { formatDateTime, formatRelativeTime } from '../../lib/date';
import { ProgressBar } from '../ui/ProgressBar';

interface ExecutionHistoryListProps {
  /** テストスイートID */
  testSuiteId: string;
  /** プロジェクトID（環境一覧取得用） */
  projectId: string;
}

/**
 * ページサイズオプション
 */
const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSize = 20;

/**
 * 日付範囲オプション
 */
const DATE_RANGE_OPTIONS = [
  { label: 'すべて', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '過去7日', value: '7days' },
  { label: '過去30日', value: '30days' },
] as const;
type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]['value'];

/**
 * 日付範囲を計算する
 */
function getDateRange(rangeValue: string): { from?: string; to?: string } {
  if (rangeValue === 'all') {
    return {};
  }

  const now = new Date();
  const to = now.toISOString();

  let from: Date;
  switch (rangeValue) {
    case 'today':
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7days':
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30days':
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      return {};
  }

  return {
    from: from.toISOString(),
    to,
  };
}

/**
 * 実行履歴一覧コンポーネント
 */
export function ExecutionHistoryList({ testSuiteId, projectId }: ExecutionHistoryListProps) {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ページネーション状態
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  // フィルタ状態
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeValue>('all');
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');

  // 現在のページ番号と総ページ数を計算
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.ceil(total / pageSize);

  // 環境一覧を取得
  useEffect(() => {
    const fetchEnvironments = async () => {
      try {
        const response = await projectsApi.getEnvironments(projectId);
        setEnvironments(response.environments);
      } catch (err) {
        // エラーは無視（環境がなくても問題ない）
        console.error('環境一覧の取得に失敗しました', err);
      }
    };
    fetchEnvironments();
  }, [projectId]);

  // 実行履歴を取得
  const fetchExecutions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dateRange = getDateRange(selectedDateRange);
      const params: ExecutionSearchParams = {
        limit: pageSize,
        offset,
        ...dateRange,
        ...(selectedEnvironmentId && { environmentId: selectedEnvironmentId }),
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      const response = await testSuitesApi.getExecutions(testSuiteId, params);
      setExecutions(response.executions);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('実行履歴の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [testSuiteId, offset, pageSize, selectedDateRange, selectedEnvironmentId]);

  // フィルタ・ページサイズ変更時にオフセットをリセット
  useEffect(() => {
    setOffset(0);
  }, [selectedDateRange, selectedEnvironmentId, pageSize]);

  // データ取得
  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  // ページ変更ハンドラ
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setOffset((newPage - 1) * pageSize);
  };

  // ページサイズ変更ハンドラ
  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
  };

  // フィルタリセット
  const handleResetFilters = () => {
    setSelectedDateRange('all');
    setSelectedEnvironmentId('');
    setPageSize(DEFAULT_PAGE_SIZE);
    setOffset(0);
  };

  // フィルタが適用されているか
  const hasFilters =
    selectedDateRange !== 'all' || selectedEnvironmentId !== '' || pageSize !== DEFAULT_PAGE_SIZE;

  // ローディング表示
  if (isLoading && executions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-danger mb-4">{error}</p>
        <button className="btn btn-primary" onClick={fetchExecutions}>
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-background-secondary rounded-lg border border-border">
        {/* 日付範囲フィルタ */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-foreground-muted" />
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value as DateRangeValue)}
            className="input text-sm py-1.5"
          >
            {DATE_RANGE_OPTIONS.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 環境フィルタ */}
        {environments.length > 0 && (
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-foreground-muted" />
            <select
              value={selectedEnvironmentId}
              onChange={(e) => setSelectedEnvironmentId(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">すべての環境</option>
              <option value="none">環境未設定</option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ページサイズ選択 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">表示件数:</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
            className="input text-sm py-1.5"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}件
              </option>
            ))}
          </select>
        </div>

        {/* フィルタリセット */}
        {hasFilters && (
          <button
            onClick={handleResetFilters}
            className="text-sm text-accent hover:text-accent-hover transition-colors"
          >
            フィルタをリセット
          </button>
        )}

        {/* 総件数 */}
        <div className="ml-auto text-sm text-foreground-muted">{total}件の実行履歴</div>
      </div>

      {/* 選択中のフィルタ表示 */}
      {(selectedDateRange !== 'all' || selectedEnvironmentId) && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          {selectedDateRange !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-background-tertiary text-foreground rounded">
              {DATE_RANGE_OPTIONS.find((o) => o.value === selectedDateRange)?.label}
              <button
                onClick={() => setSelectedDateRange('all')}
                className="hover:text-foreground-muted"
                aria-label="日付範囲フィルタを解除"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {selectedEnvironmentId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-background-tertiary text-foreground rounded">
              {selectedEnvironmentId === 'none'
                ? '環境未設定'
                : environments.find((e) => e.id === selectedEnvironmentId)?.name}
              <button
                onClick={() => setSelectedEnvironmentId('')}
                className="hover:text-foreground-muted"
                aria-label="環境フィルタを解除"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* 実行履歴一覧 */}
      {executions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground-muted">
            {hasFilters ? '条件に一致する実行履歴がありません' : '実行履歴がありません'}
          </p>
        </div>
      ) : (
        <>
          {/* ローディングオーバーレイ */}
          <div className={`relative ${isLoading ? 'opacity-50' : ''}`}>
            <div className="space-y-2">
              {executions.map((execution) => (
                <ExecutionItem key={execution.id} execution={execution} />
              ))}
            </div>

            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-foreground" />
              </div>
            )}
          </div>

          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <p className="text-sm text-foreground-muted">
                {total}件中 {offset + 1} - {Math.min(offset + pageSize, total)}件を表示
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="前のページ"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-sm text-foreground">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="次のページ"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * 実行履歴アイテム
 */
export function ExecutionItem({ execution }: { execution: Execution }) {
  // judgmentCountsから値を取得
  const counts = execution.judgmentCounts || { PASS: 0, FAIL: 0, PENDING: 0, SKIPPED: 0 };
  const total = counts.PASS + counts.FAIL + counts.PENDING + counts.SKIPPED;

  // 合格率を計算（PENDING も分母に含める）
  const passRate = total > 0 ? Math.round((counts.PASS / total) * 100) : 0;

  return (
    <Link
      to={`/executions/${execution.id}`}
      className="flex items-center gap-4 p-4 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors"
    >
      {/* 環境名 */}
      {execution.environment && (
        <span className="px-2 py-0.5 text-xs font-medium rounded bg-background-tertiary text-foreground-muted shrink-0">
          {execution.environment.name}
        </span>
      )}

      {/* 実行者 */}
      <div className="flex items-center gap-2 shrink-0">
        {execution.executedByUser?.avatarUrl ? (
          <img
            src={execution.executedByUser.avatarUrl}
            alt={execution.executedByUser.name}
            className="w-6 h-6 rounded-full"
          />
        ) : execution.executedByUser ? (
          <div className="w-6 h-6 rounded-full bg-accent-subtle flex items-center justify-center">
            <span className="text-xs font-medium text-accent">
              {execution.executedByUser.name.charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center">
            <User className="w-3 h-3 text-foreground-muted" />
          </div>
        )}
        <span className="text-sm text-foreground">
          {execution.executedByUser?.name || 'Unknown'}
        </span>
      </div>

      {/* 期待結果の状況バー + 合格率ラベル */}
      {total > 0 && (
        <div className="flex items-center gap-2">
          <div className="w-32">
            <ProgressBar
              passed={counts.PASS}
              failed={counts.FAIL}
              skipped={counts.SKIPPED}
              total={total}
              size="sm"
            />
          </div>
          <span
            className="text-xs text-foreground-muted font-code shrink-0 whitespace-nowrap"
            data-testid="pass-rate-label"
          >
            {counts.PASS}/{total} ({passRate}%)
          </span>
        </div>
      )}

      {/* 日時（右寄せ） */}
      <div className="ml-auto text-right shrink-0">
        <span className="text-sm text-foreground-muted" title={formatDateTime(execution.createdAt)}>
          {formatRelativeTime(execution.createdAt)}
        </span>
      </div>
    </Link>
  );
}
