import { useState, useEffect, useCallback, useRef } from 'react';
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
  HelpCircle,
  Download,
  Check,
} from 'lucide-react';
import {
  organizationsApi,
  ApiError,
  type AuditLog,
  type AuditLogQueryParams,
  type AuditLogExportFormat,
} from '../../lib/api';
import { formatDateTime, formatRelativeTime } from '../../lib/date';
import { AuditLogDetailModal } from './AuditLogDetailModal';

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
 * カテゴリキーかどうかを判定する型ガード
 */
function isCategoryKey(key: string): key is CategoryKey {
  return key in AUDIT_LOG_CATEGORIES;
}

/** カテゴリフィルタの「すべて」を表す定数 */
const CATEGORY_FILTER_ALL = 'all' as const;
type CategoryFilter = CategoryKey | typeof CATEGORY_FILTER_ALL;

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
  // 型ガードを使用して安全にアクセス
  if (isCategoryKey(category)) {
    const Icon = AUDIT_LOG_CATEGORIES[category].icon;
    return <Icon className={className} />;
  }
  // 未知のカテゴリの場合はヘルプアイコンを表示
  return <HelpCircle className={className} />;
}

/**
 * カテゴリバッジ
 */
function CategoryBadge({ category }: { category: string }) {
  // 型ガードを使用して安全にアクセス
  const isKnownCategory = isCategoryKey(category);
  const label = isKnownCategory ? AUDIT_LOG_CATEGORIES[category].label : category;
  const colorClass = isKnownCategory
    ? AUDIT_LOG_CATEGORIES[category].color
    : 'text-foreground-muted';

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
 * ページサイズオプション
 */
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
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
  { label: '過去90日', value: '90days' },
] as const;
type DateRangeValue = (typeof DATE_RANGE_OPTIONS)[number]['value'];

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
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // フィルタ状態（型安全）
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>(CATEGORY_FILTER_ALL);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRangeValue>('all');

  // 詳細モーダル状態
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // エクスポートメニュー状態
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<AuditLogExportFormat | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 監査ログを取得
  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dateRange = getDateRange(selectedDateRange);
      const params: AuditLogQueryParams = {
        page,
        limit: pageSize,
        ...(selectedCategory !== CATEGORY_FILTER_ALL && { category: selectedCategory }),
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
  }, [organizationId, page, pageSize, selectedCategory, selectedDateRange]);

  // フィルタ・ページサイズ変更時にページをリセット
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, selectedDateRange, pageSize]);

  // データ取得
  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // ページ変更ハンドラ
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // ページサイズ変更ハンドラ
  const handlePageSizeChange = (newSize: PageSize) => {
    setPageSize(newSize);
  };

  // フィルタリセット
  const handleResetFilters = () => {
    setSelectedCategory(CATEGORY_FILTER_ALL);
    setSelectedDateRange('all');
    setPageSize(DEFAULT_PAGE_SIZE);
    setPage(1);
  };

  // ログクリックハンドラ
  const handleLogClick = (log: AuditLog) => {
    setSelectedLog(log);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setSelectedLog(null);
  };

  // エクスポート処理
  const handleExport = async (format: AuditLogExportFormat) => {
    setIsExporting(true);
    setExportSuccess(null);

    try {
      const dateRange = getDateRange(selectedDateRange);
      const blob = await organizationsApi.exportAuditLogs(organizationId, {
        format,
        ...(selectedCategory !== CATEGORY_FILTER_ALL && { category: selectedCategory }),
        ...dateRange,
      });

      // ファイルダウンロード
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      a.download = `audit-logs-${timestamp}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(format);
      setTimeout(() => setExportSuccess(null), 2000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('エクスポートに失敗しました');
      }
    } finally {
      setIsExporting(false);
      setShowExportMenu(false);
    }
  };

  // エクスポートメニューを外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  // フィルタが適用されているか
  const hasFilters =
    selectedCategory !== CATEGORY_FILTER_ALL ||
    selectedDateRange !== 'all' ||
    pageSize !== DEFAULT_PAGE_SIZE;

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
            onChange={(e) => setSelectedCategory(e.target.value as CategoryFilter)}
            className="input text-sm py-1.5"
          >
            <option value={CATEGORY_FILTER_ALL}>すべてのカテゴリ</option>
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

        {/* スペーサー */}
        <div className="flex-1" />

        {/* エクスポートボタン */}
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={isExporting || total === 0}
            className="btn btn-secondary flex items-center gap-1.5 text-sm py-1.5"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : exportSuccess ? (
              <Check className="w-4 h-4 text-success" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {exportSuccess ? 'エクスポート完了' : 'エクスポート'}
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-1 py-1 bg-background border border-border rounded-lg shadow-lg z-10 min-w-[140px]">
              <button
                onClick={() => handleExport('csv')}
                className="w-full px-4 py-2 text-sm text-left text-foreground hover:bg-background-secondary transition-colors"
              >
                CSV形式
              </button>
              <button
                onClick={() => handleExport('json')}
                className="w-full px-4 py-2 text-sm text-left text-foreground hover:bg-background-secondary transition-colors"
              >
                JSON形式
              </button>
            </div>
          )}
        </div>
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
                <AuditLogItem key={log.id} log={log} onClick={() => handleLogClick(log)} />
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
                {total}件中 {(page - 1) * pageSize + 1} -{' '}
                {Math.min(page * pageSize, total)}件を表示
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

      {/* 詳細モーダル */}
      <AuditLogDetailModal
        isOpen={selectedLog !== null}
        log={selectedLog}
        onClose={handleCloseModal}
      />
    </div>
  );
}

/** 詳細表示から除外するフィールド */
const EXCLUDED_DETAIL_FIELDS = new Set(['id', 'userId', 'organizationId', 'createdAt', 'updatedAt']);

/** 既知のフィールドラベルマッピング */
const KNOWN_FIELD_LABELS: Record<string, string> = {
  email: 'メール',
  name: '名前',
  role: 'ロール',
  oldRole: '変更前ロール',
  newRole: '変更後ロール',
  targetName: '対象',
  reason: '理由',
  description: '説明',
  ipAddress: 'IPアドレス',
};

/**
 * 値を表示用文字列に変換
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface AuditLogItemProps {
  log: AuditLog;
  onClick: () => void;
}

/**
 * 監査ログアイテム
 */
function AuditLogItem({ log, onClick }: AuditLogItemProps) {
  // 詳細情報をフォーマット
  const formatDetails = (details: Record<string, unknown> | null): string => {
    if (!details) return '';

    const parts: string[] = [];
    const processedFields = new Set<string>();

    // ロール変更の特別処理（oldRole → newRole として表示）
    if (details.oldRole && details.newRole) {
      parts.push(`${details.oldRole} → ${details.newRole}`);
      processedFields.add('oldRole');
      processedFields.add('newRole');
    }

    // 既知のフィールドを優先的に処理
    const priorityFields = ['email', 'name', 'targetName', 'role', 'reason'];
    for (const field of priorityFields) {
      if (details[field] && !processedFields.has(field)) {
        const value = formatValue(details[field]);
        if (value) {
          // email, name, targetNameはラベルなしで表示
          if (['email', 'name', 'targetName'].includes(field)) {
            parts.push(value);
          } else {
            const label = KNOWN_FIELD_LABELS[field] || field;
            parts.push(`${label}: ${value}`);
          }
          processedFields.add(field);
        }
      }
    }

    // 残りのフィールドをフォールバックとして処理
    for (const [key, value] of Object.entries(details)) {
      if (processedFields.has(key) || EXCLUDED_DETAIL_FIELDS.has(key)) continue;
      const formattedValue = formatValue(value);
      if (formattedValue) {
        const label = KNOWN_FIELD_LABELS[key] || key;
        parts.push(`${label}: ${formattedValue}`);
      }
    }

    return parts.join(' | ');
  };

  const detailsText = formatDetails(log.details);

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-4 p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
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
