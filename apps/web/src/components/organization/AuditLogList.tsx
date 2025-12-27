import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  User,
  Shield,
  Building2,
  Users,
  FolderKanban,
  Key,
  CreditCard,
  Filter,
  Calendar,
} from 'lucide-react';
import {
  organizationsApi,
  ApiError,
  type AuditLog,
  type AuditLogQueryParams,
} from '../../lib/api';
import { formatDateTime, formatRelativeTime } from '../../lib/date';

interface AuditLogListProps {
  /** 組織ID */
  organizationId: string;
}

/**
 * 監査ログのカテゴリ定義
 */
const AUDIT_LOG_CATEGORIES = {
  AUTH: { label: '認証', icon: Shield, color: 'text-blue-500' },
  USER: { label: 'ユーザー', icon: User, color: 'text-green-500' },
  ORGANIZATION: { label: '組織', icon: Building2, color: 'text-purple-500' },
  MEMBER: { label: 'メンバー', icon: Users, color: 'text-orange-500' },
  PROJECT: { label: 'プロジェクト', icon: FolderKanban, color: 'text-cyan-500' },
  API_TOKEN: { label: 'APIトークン', icon: Key, color: 'text-yellow-500' },
  BILLING: { label: '課金', icon: CreditCard, color: 'text-pink-500' },
} as const;

type CategoryKey = keyof typeof AUDIT_LOG_CATEGORIES;

/**
 * カテゴリに対応するアイコンを取得
 */
function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const categoryConfig = AUDIT_LOG_CATEGORIES[category as CategoryKey];
  if (!categoryConfig) {
    return <Shield className={className} />;
  }
  const Icon = categoryConfig.icon;
  return <Icon className={className} />;
}

/**
 * カテゴリバッジ
 */
function CategoryBadge({ category }: { category: string }) {
  const config = AUDIT_LOG_CATEGORIES[category as CategoryKey];
  const label = config?.label || category;
  const colorClass = config?.color || 'text-foreground-muted';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${colorClass} bg-background-tertiary`}
    >
      <CategoryIcon category={category} className="w-3 h-3" />
      {label}
    </span>
  );
}

/**
 * ページサイズ
 */
const PAGE_SIZE = 20;

/**
 * 日付範囲オプション
 */
const DATE_RANGE_OPTIONS = [
  { label: 'すべて', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '過去7日', value: '7days' },
  { label: '過去30日', value: '30days' },
  { label: '過去90日', value: '90days' },
] as const;

/**
 * 日付範囲を計算する
 */
function getDateRange(
  rangeValue: string
): { startDate?: string; endDate?: string } {
  if (rangeValue === 'all') {
    return {};
  }

  const now = new Date();
  const endDate = now.toISOString();

  let startDate: Date;
  switch (rangeValue) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case '7days':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30days':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90days':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      return {};
  }

  return {
    startDate: startDate.toISOString(),
    endDate,
  };
}

/**
 * 監査ログ一覧コンポーネント
 */
export function AuditLogList({ organizationId }: AuditLogListProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ページネーション状態
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // フィルタ状態
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedDateRange, setSelectedDateRange] = useState<string>('all');

  // 監査ログを取得
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dateRange = getDateRange(selectedDateRange);
      const params: AuditLogQueryParams = {
        page,
        limit: PAGE_SIZE,
        ...(selectedCategory && { category: selectedCategory }),
        ...dateRange,
      };

      const response = await organizationsApi.getAuditLogs(
        organizationId,
        params
      );
      setLogs(response.logs);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('監査ログの取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, page, selectedCategory, selectedDateRange]);

  // フィルタ変更時にページをリセット
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedDateRange]);

  // データ取得
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ページ変更ハンドラ
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // フィルタリセット
  const handleResetFilters = () => {
    setSelectedCategory('');
    setSelectedDateRange('all');
    setPage(1);
  };

  // フィルタが適用されているか
  const hasFilters = selectedCategory !== '' || selectedDateRange !== 'all';

  // ローディング表示
  if (isLoading && logs.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">監査ログ</h2>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">監査ログ</h2>
        <div className="text-center py-12">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchLogs}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">監査ログ</h2>
        <span className="text-sm text-foreground-muted">{total}件の操作</span>
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-background-secondary rounded-lg border border-border">
        {/* カテゴリフィルタ */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-foreground-muted" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input text-sm py-1.5"
          >
            <option value="">すべてのカテゴリ</option>
            {Object.entries(AUDIT_LOG_CATEGORIES).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* 日付範囲フィルタ */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-foreground-muted" />
          <select
            value={selectedDateRange}
            onChange={(e) => setSelectedDateRange(e.target.value)}
            className="input text-sm py-1.5"
          >
            {DATE_RANGE_OPTIONS.map(({ label, value }) => (
              <option key={value} value={value}>
                {label}
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
      </div>

      {/* ログ一覧 */}
      {logs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground-muted">
            {hasFilters
              ? '条件に一致する監査ログがありません'
              : '監査ログがありません'}
          </p>
        </div>
      ) : (
        <>
          {/* ローディングオーバーレイ */}
          <div className={`relative ${isLoading ? 'opacity-50' : ''}`}>
            <div className="space-y-2">
              {logs.map((log) => (
                <AuditLogItem key={log.id} log={log} />
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
                {total}件中 {(page - 1) * PAGE_SIZE + 1} -{' '}
                {Math.min(page * PAGE_SIZE, total)}件を表示
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="前のページ"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <span className="text-sm text-foreground">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
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
 * 監査ログアイテム
 */
function AuditLogItem({ log }: { log: AuditLog }) {
  // 詳細情報をフォーマット
  const formatDetails = (details: Record<string, unknown> | null): string => {
    if (!details) return '';

    const parts: string[] = [];

    // 共通の詳細フィールドを処理
    if (details.email) {
      parts.push(`${details.email}`);
    }
    if (details.name) {
      parts.push(`${details.name}`);
    }
    if (details.role) {
      parts.push(`ロール: ${details.role}`);
    }
    if (details.oldRole && details.newRole) {
      parts.push(`${details.oldRole} → ${details.newRole}`);
    }
    if (details.targetName) {
      parts.push(`${details.targetName}`);
    }

    return parts.join(' | ');
  };

  const detailsText = formatDetails(log.details);

  return (
    <div className="flex items-start gap-4 p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors">
      {/* ユーザーアバター */}
      <div className="flex-shrink-0">
        {log.user?.avatarUrl ? (
          <img
            src={log.user.avatarUrl}
            alt={log.user.name}
            className="w-8 h-8 rounded-full"
          />
        ) : log.user ? (
          <div className="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center">
            <span className="text-xs font-medium text-accent">
              {log.user.name.charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-background-tertiary flex items-center justify-center">
            <User className="w-4 h-4 text-foreground-muted" />
          </div>
        )}
      </div>

      {/* ログ情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* カテゴリバッジ */}
          <CategoryBadge category={log.category} />

          {/* アクション */}
          <span className="font-medium text-foreground text-sm">
            {log.action}
          </span>
        </div>

        {/* 詳細情報 */}
        {detailsText && (
          <p className="mt-1 text-sm text-foreground-muted truncate">
            {detailsText}
          </p>
        )}

        {/* ユーザー情報 */}
        <div className="mt-1 flex items-center gap-2 text-xs text-foreground-subtle">
          {log.user ? (
            <span>{log.user.name}</span>
          ) : (
            <span>システム</span>
          )}
          <span>•</span>
          <span title={formatDateTime(log.createdAt)}>
            {formatRelativeTime(log.createdAt)}
          </span>
        </div>
      </div>

      {/* 日時（デスクトップのみ） */}
      <div className="hidden md:block flex-shrink-0 text-right">
        <span className="text-xs text-foreground-subtle">
          {formatDateTime(log.createdAt)}
        </span>
      </div>
    </div>
  );
}
