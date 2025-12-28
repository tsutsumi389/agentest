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
  projectsApi,
  ApiError,
  type Project,
  type ProjectHistory,
  type ProjectChangeType,
} from '../../lib/api';
import { formatDateTime, formatRelativeTime } from '../../lib/date';

interface HistoryListProps {
  /** プロジェクト */
  project: Project;
}

/**
 * 変更タイプの定義
 */
const CHANGE_TYPES: Record<ProjectChangeType, { label: string; icon: typeof PlusCircle; color: string }> = {
  CREATE: { label: '作成', icon: PlusCircle, color: 'text-green-500' },
  UPDATE: { label: '更新', icon: Pencil, color: 'text-blue-500' },
  DELETE: { label: '削除', icon: Trash2, color: 'text-danger' },
  RESTORE: { label: '復元', icon: RotateCcw, color: 'text-purple-500' },
};

/**
 * ページサイズオプション
 */
const PAGE_SIZE = 20;

/**
 * プロジェクト変更履歴一覧コンポーネント
 */
export function HistoryList({ project }: HistoryListProps) {
  const [histories, setHistories] = useState<ProjectHistory[]>([]);
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
      const response = await projectsApi.getHistories(project.id, {
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
  }, [project.id, page]);

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
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">変更履歴</h2>
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
        <h2 className="text-lg font-semibold text-foreground mb-4">変更履歴</h2>
        <div className="text-center py-12">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchHistories}>
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
        <h2 className="text-lg font-semibold text-foreground">変更履歴</h2>
        <span className="text-sm text-foreground-muted">{total}件の変更</span>
      </div>

      {/* 履歴一覧 */}
      {histories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground-muted">変更履歴がありません</p>
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
 * スナップショットの変更内容をフォーマット
 */
function formatSnapshot(snapshot: Record<string, unknown>, changeType: ProjectChangeType): string {
  if (changeType === 'CREATE') {
    const name = snapshot.name as string | undefined;
    return name ? `プロジェクト「${name}」を作成` : 'プロジェクトを作成';
  }

  if (changeType === 'DELETE') {
    return 'プロジェクトを削除';
  }

  if (changeType === 'RESTORE') {
    return 'プロジェクトを復元';
  }

  // UPDATEの場合、変更されたフィールドを表示
  const changes: string[] = [];

  if (snapshot.name !== undefined) {
    changes.push(`名前を「${snapshot.name}」に変更`);
  }

  if (snapshot.description !== undefined) {
    if (snapshot.description === null || snapshot.description === '') {
      changes.push('説明を削除');
    } else {
      changes.push('説明を更新');
    }
  }

  return changes.length > 0 ? changes.join('、') : '設定を更新';
}

/**
 * 履歴アイテム
 */
function HistoryItem({ history }: { history: ProjectHistory }) {
  const changeTypeDef = CHANGE_TYPES[history.changeType];
  const Icon = changeTypeDef.icon;

  return (
    <div className="relative flex items-start gap-4 pl-8">
      {/* タイムラインドット */}
      <div
        className={`absolute left-0 w-8 h-8 rounded-full bg-background-secondary border-2 border-border flex items-center justify-center ${changeTypeDef.color}`}
      >
        <Icon className="w-4 h-4" />
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
                className="w-8 h-8 rounded-full"
              />
            ) : history.changedBy ? (
              <div className="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center">
                <span className="text-xs font-medium text-accent">
                  {history.changedBy.name.charAt(0).toUpperCase()}
                </span>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-background-tertiary flex items-center justify-center">
                <User className="w-4 h-4 text-foreground-muted" />
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
              <span className="text-sm text-foreground">
                {history.changedBy?.name || 'システム'}
              </span>
            </div>

            {/* 変更内容 */}
            <p className="mt-1 text-sm text-foreground-muted">
              {formatSnapshot(history.snapshot, history.changeType)}
            </p>

            {/* 変更理由 */}
            {history.changeReason && (
              <p className="mt-1 text-sm text-foreground-subtle italic">
                理由: {history.changeReason}
              </p>
            )}

            {/* 日時 */}
            <p className="mt-1 text-xs text-foreground-subtle">
              <span title={formatDateTime(history.createdAt)}>
                {formatRelativeTime(history.createdAt)}
              </span>
              <span className="hidden md:inline ml-2">
                ({formatDateTime(history.createdAt)})
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
