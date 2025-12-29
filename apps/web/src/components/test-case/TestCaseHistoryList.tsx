import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Pencil,
  Trash2,
  RotateCcw,
  User,
} from 'lucide-react';
import {
  testCasesApi,
  ApiError,
  type TestCase,
  type TestCaseHistory,
  type TestCaseChangeType,
} from '../../lib/api';
import { formatDateTime, formatRelativeTime } from '../../lib/date';

interface TestCaseHistoryListProps {
  /** テストケース */
  testCase: TestCase;
}

/**
 * 変更タイプの定義
 */
const CHANGE_TYPES: Record<TestCaseChangeType, { label: string; icon: typeof PlusCircle; color: string }> = {
  CREATE: { label: '作成', icon: PlusCircle, color: 'text-green-500' },
  UPDATE: { label: '更新', icon: Pencil, color: 'text-blue-500' },
  DELETE: { label: '削除', icon: Trash2, color: 'text-danger' },
  RESTORE: { label: '復元', icon: RotateCcw, color: 'text-purple-500' },
};

/**
 * ページサイズ
 */
const PAGE_SIZE = 20;

/**
 * テストケース変更履歴一覧コンポーネント
 */
export function TestCaseHistoryList({ testCase }: TestCaseHistoryListProps) {
  const [histories, setHistories] = useState<TestCaseHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ページネーション状態
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // 履歴を取得
  const fetchHistories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await testCasesApi.getHistories(testCase.id, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setHistories(response.histories);
      setTotal(response.total);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('履歴の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [testCase.id, page]);

  // データ取得
  useEffect(() => {
    fetchHistories();
  }, [fetchHistories]);

  // ページ変更ハンドラ
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // ローディング表示
  if (isLoading && histories.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">変更履歴</h3>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  // エラー表示
  if (error) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">変更履歴</h3>
        <div className="text-center py-12">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary btn-sm" onClick={fetchHistories}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">変更履歴</h3>
        <span className="text-xs text-foreground-muted">{total}件の変更</span>
      </div>

      {/* 履歴一覧 */}
      {histories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground-muted text-sm">変更履歴がありません</p>
        </div>
      ) : (
        <>
          {/* ローディングオーバーレイ */}
          <div className={`relative ${isLoading ? 'opacity-50' : ''}`}>
            {/* タイムライン */}
            <div className="relative">
              {/* 縦線 */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              {/* 履歴アイテム */}
              <div className="space-y-4">
                {histories.map((history) => (
                  <HistoryItem key={history.id} history={history} />
                ))}
              </div>
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
              <p className="text-xs text-foreground-muted">
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
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs text-foreground">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="次のページ"
                >
                  <ChevronRight className="w-4 h-4" />
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
 * スナップショットの変更内容をフォーマット
 */
function formatSnapshot(snapshot: Record<string, unknown>, changeType: TestCaseChangeType): string {
  if (changeType === 'CREATE') {
    const title = snapshot.title as string | undefined;
    return title ? `テストケース「${title}」を作成` : 'テストケースを作成';
  }

  if (changeType === 'DELETE') {
    return 'テストケースを削除';
  }

  if (changeType === 'RESTORE') {
    return 'テストケースを復元';
  }

  // UPDATEの場合、変更されたフィールドを表示
  const changes: string[] = [];

  if (snapshot.title !== undefined) {
    changes.push(`タイトルを「${snapshot.title}」に変更`);
  }

  if (snapshot.description !== undefined) {
    if (snapshot.description === null || snapshot.description === '') {
      changes.push('説明を削除');
    } else {
      changes.push('説明を更新');
    }
  }

  if (snapshot.priority !== undefined) {
    const priorityLabels: Record<string, string> = {
      CRITICAL: '緊急',
      HIGH: '高',
      MEDIUM: '中',
      LOW: '低',
    };
    const priorityLabel = priorityLabels[snapshot.priority as string] || snapshot.priority;
    changes.push(`優先度を「${priorityLabel}」に変更`);
  }

  if (snapshot.status !== undefined) {
    const statusLabels: Record<string, string> = {
      DRAFT: '下書き',
      ACTIVE: 'アクティブ',
      ARCHIVED: 'アーカイブ',
    };
    const statusLabel = statusLabels[snapshot.status as string] || snapshot.status;
    changes.push(`ステータスを「${statusLabel}」に変更`);
  }

  // 前提条件の変更
  if (snapshot.preconditions !== undefined) {
    const preconditions = snapshot.preconditions as unknown[];
    if (Array.isArray(preconditions)) {
      if (preconditions.length === 0) {
        changes.push('前提条件をすべて削除');
      } else {
        changes.push(`前提条件を${preconditions.length}件に更新`);
      }
    } else {
      changes.push('前提条件を更新');
    }
  }

  // ステップの変更
  if (snapshot.steps !== undefined) {
    const steps = snapshot.steps as unknown[];
    if (Array.isArray(steps)) {
      if (steps.length === 0) {
        changes.push('テスト手順をすべて削除');
      } else {
        changes.push(`テスト手順を${steps.length}件に更新`);
      }
    } else {
      changes.push('テスト手順を更新');
    }
  }

  // 期待結果の変更
  if (snapshot.expectedResults !== undefined) {
    const expectedResults = snapshot.expectedResults as unknown[];
    if (Array.isArray(expectedResults)) {
      if (expectedResults.length === 0) {
        changes.push('期待結果をすべて削除');
      } else {
        changes.push(`期待結果を${expectedResults.length}件に更新`);
      }
    } else {
      changes.push('期待結果を更新');
    }
  }

  return changes.length > 0 ? changes.join('、') : '設定を更新';
}

/**
 * 履歴アイテム
 */
function HistoryItem({ history }: { history: TestCaseHistory }) {
  const changeTypeDef = CHANGE_TYPES[history.changeType];
  const Icon = changeTypeDef.icon;

  return (
    <div className="relative flex items-start gap-4 pl-8">
      {/* タイムラインドット */}
      <div
        className={`absolute left-0 w-8 h-8 rounded-full bg-background-secondary border-2 border-border flex items-center justify-center ${changeTypeDef.color}`}
        role="img"
        aria-label={changeTypeDef.label}
      >
        <Icon className="w-4 h-4" aria-hidden="true" />
      </div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-start gap-3">
          {/* ユーザーアバター */}
          <div className="flex-shrink-0">
            {history.changedBy?.avatarUrl ? (
              <img
                src={history.changedBy.avatarUrl}
                alt={history.changedBy.name}
                className="w-6 h-6 rounded-full"
              />
            ) : history.changedBy ? (
              <div className="w-6 h-6 rounded-full bg-accent-subtle flex items-center justify-center">
                <span className="text-xs font-medium text-accent">
                  {history.changedBy.name.charAt(0).toUpperCase()}
                </span>
              </div>
            ) : (
              <div className="w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center">
                <User className="w-3 h-3 text-foreground-muted" />
              </div>
            )}
          </div>

          {/* 情報 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 変更タイプバッジ */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${changeTypeDef.color} bg-background-tertiary`}
              >
                <Icon className="w-3 h-3" />
                {changeTypeDef.label}
              </span>

              {/* ユーザー名 */}
              <span className="text-xs text-foreground">
                {history.changedBy?.name || 'システム'}
              </span>
            </div>

            {/* 変更内容 */}
            <p className="mt-1 text-xs text-foreground-muted">
              {formatSnapshot(history.snapshot, history.changeType)}
            </p>

            {/* 変更理由 */}
            {history.changeReason && (
              <p className="mt-1 text-xs text-foreground-subtle italic">
                理由: {history.changeReason}
              </p>
            )}

            {/* 日時 */}
            <p className="mt-1 text-xs text-foreground-subtle">
              <span title={formatDateTime(history.createdAt)}>
                {formatRelativeTime(history.createdAt)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
