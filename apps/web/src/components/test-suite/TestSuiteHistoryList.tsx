import { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PlusCircle,
  Pencil,
  Trash2,
  RotateCcw,
  User,
  Layers,
  FileText,
  List,
  type LucideIcon,
} from 'lucide-react';
import {
  testSuitesApi,
  ApiError,
  type TestSuite,
  type TestSuiteHistory,
  type TestSuiteHistoryGroupedItem,
  type TestSuiteChangeType,
  type TestSuiteCategorizedHistories,
} from '../../lib/api';
import { type TestSuiteChangeDetail } from '@agentest/shared';
import { formatDateTime, formatRelativeTime } from '../../lib/date';

interface TestSuiteHistoryListProps {
  /** テストスイート */
  testSuite: TestSuite;
}

/**
 * 変更タイプの定義
 */
const CHANGE_TYPES: Record<TestSuiteChangeType, { label: string; icon: typeof PlusCircle; color: string }> = {
  CREATE: { label: '作成', icon: PlusCircle, color: 'text-green-500' },
  UPDATE: { label: '更新', icon: Pencil, color: 'text-blue-500' },
  DELETE: { label: '削除', icon: Trash2, color: 'text-danger' },
  RESTORE: { label: '復元', icon: RotateCcw, color: 'text-purple-500' },
};

/**
 * ページサイズ（グループ単位）
 */
const PAGE_SIZE = 20;

/**
 * カテゴリの定義
 */
const CATEGORY_DEFINITIONS: Record<
  keyof TestSuiteCategorizedHistories,
  { label: string; icon: LucideIcon; order: number }
> = {
  basicInfo: { label: '基本情報', icon: FileText, order: 0 },
  preconditions: { label: '前提条件', icon: List, order: 1 },
};

/**
 * カテゴリ別履歴の総数を取得
 */
function getTotalHistoryCount(categorizedHistories: TestSuiteCategorizedHistories): number {
  return (
    categorizedHistories.basicInfo.length +
    categorizedHistories.preconditions.length
  );
}

/**
 * グループ化されたアイテムが複数履歴を持つかどうかを判定
 * 複数履歴の場合はグループ表示、単一履歴の場合は個別表示
 */
function isMultipleHistoryGroup(item: TestSuiteHistoryGroupedItem): boolean {
  return getTotalHistoryCount(item.categorizedHistories) > 1;
}

/**
 * カテゴリ別履歴から最初の履歴を取得
 */
function getFirstHistory(categorizedHistories: TestSuiteCategorizedHistories): TestSuiteHistory | null {
  for (const category of ['basicInfo', 'preconditions'] as const) {
    if (categorizedHistories[category].length > 0) {
      return categorizedHistories[category][0];
    }
  }
  return null;
}

/**
 * テストスイート変更履歴一覧コンポーネント
 */
export function TestSuiteHistoryList({ testSuite }: TestSuiteHistoryListProps) {
  // バックエンドからグループ化済みのアイテムを受け取る
  const [groupedItems, setGroupedItems] = useState<TestSuiteHistoryGroupedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ページネーション状態（グループ単位）
  const [page, setPage] = useState(1);
  const [totalGroups, setTotalGroups] = useState(0);
  const [total, setTotal] = useState(0); // 履歴レコード総数（表示用）

  const totalPages = Math.ceil(totalGroups / PAGE_SIZE);

  // 履歴を取得（グループ化済み）
  const fetchHistories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await testSuitesApi.getHistories(testSuite.id, {
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      });
      setGroupedItems(response.items);
      setTotalGroups(response.totalGroups);
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
  }, [testSuite.id, page]);

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
  if (isLoading && groupedItems.length === 0) {
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
      {groupedItems.length === 0 ? (
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
                {groupedItems.map((item) => {
                  const firstHistory = getFirstHistory(item.categorizedHistories);
                  if (!firstHistory) return null;
                  return isMultipleHistoryGroup(item) ? (
                    <HistoryGroupItem key={item.groupId ?? firstHistory.id} group={item} />
                  ) : (
                    <HistoryItem key={firstHistory.id} history={firstHistory} />
                  );
                })}
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
                {totalGroups}グループ中 {(page - 1) * PAGE_SIZE + 1} -{' '}
                {Math.min(page * PAGE_SIZE, totalGroups)}グループを表示
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
 * フィールド名のラベル
 */
const FIELD_LABELS: Record<string, string> = {
  name: '名前',
  description: '説明',
  status: 'ステータス',
};

/**
 * ステータスのラベル
 */
const STATUS_LABELS: Record<string, string> = {
  DRAFT: '下書き',
  ACTIVE: 'アクティブ',
  ARCHIVED: 'アーカイブ',
};

/**
 * changeDetailから変更されたフィールド名を抽出
 */
function getChangedFields(snapshot: Record<string, unknown>): string[] {
  const changeDetail = snapshot.changeDetail as TestSuiteChangeDetail | undefined;
  if (!changeDetail) return [];

  switch (changeDetail.type) {
    case 'BASIC_INFO_UPDATE':
      return Object.keys(changeDetail.fields).map((key) => FIELD_LABELS[key] || key);
    case 'PRECONDITION_ADD':
      return ['前提条件（追加）'];
    case 'PRECONDITION_UPDATE':
      return ['前提条件'];
    case 'PRECONDITION_DELETE':
      return ['前提条件（削除）'];
    case 'PRECONDITION_REORDER':
      return ['前提条件（並び替え）'];
    case 'TEST_CASE_REORDER':
      return ['テストケース（並び替え）'];
    default:
      return [];
  }
}

/**
 * changeDetailが存在するか確認
 */
function hasChangeDetail(snapshot: Record<string, unknown>): boolean {
  return snapshot.changeDetail != null;
}

/**
 * 変更内容のサマリーを取得
 */
function getChangeSummary(snapshot: Record<string, unknown>, changeType: TestSuiteChangeType): string {
  if (changeType === 'CREATE') {
    const name = snapshot.name as string | undefined;
    return name ? `テストスイート「${name}」を作成` : 'テストスイートを作成';
  }

  if (changeType === 'DELETE') {
    return 'テストスイートを削除';
  }

  if (changeType === 'RESTORE') {
    return 'テストスイートを復元';
  }

  // UPDATEの場合
  const changedFields = getChangedFields(snapshot);
  if (changedFields.length > 0) {
    return `${changedFields.join('、')}を変更`;
  }

  // changeDetailがない古いデータの場合（後方互換性）
  const changes: string[] = [];
  if (snapshot.name !== undefined) changes.push('名前');
  if (snapshot.description !== undefined) changes.push('説明');
  if (snapshot.status !== undefined) changes.push('ステータス');
  if (snapshot.preconditions !== undefined) changes.push('前提条件');
  if (snapshot.preconditionOrder !== undefined) changes.push('前提条件の順序');

  return changes.length > 0 ? `${changes.join('、')}を変更` : '設定を更新';
}

/**
 * 差分表示コンポーネント
 */
function DiffView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const changeDetail = snapshot.changeDetail as TestSuiteChangeDetail | undefined;

  if (!changeDetail) {
    return (
      <p className="text-xs text-foreground-muted italic">
        詳細な差分情報がありません（過去のデータ）
      </p>
    );
  }

  // BASIC_INFO_UPDATEの場合
  if (changeDetail.type === 'BASIC_INFO_UPDATE') {
    const { fields } = changeDetail;
    return (
      <div className="space-y-2">
        {fields.name && (
          <DiffField
            label="名前"
            before={fields.name.before}
            after={fields.name.after}
          />
        )}
        {fields.description && (
          <DiffField
            label="説明"
            before={fields.description.before || '（なし）'}
            after={fields.description.after || '（なし）'}
          />
        )}
        {fields.status && (
          <DiffField
            label="ステータス"
            before={STATUS_LABELS[fields.status.before] || fields.status.before}
            after={STATUS_LABELS[fields.status.after] || fields.status.after}
          />
        )}
      </div>
    );
  }

  // 前提条件の変更
  if (changeDetail.type === 'PRECONDITION_UPDATE') {
    return (
      <DiffField
        label="前提条件"
        before={changeDetail.before.content}
        after={changeDetail.after.content}
      />
    );
  }

  if (changeDetail.type === 'PRECONDITION_ADD') {
    return (
      <div className="text-xs">
        <span className="text-foreground-muted">追加: </span>
        <span className="text-green-600">{changeDetail.added.content}</span>
      </div>
    );
  }

  if (changeDetail.type === 'PRECONDITION_DELETE') {
    return (
      <div className="text-xs">
        <span className="text-foreground-muted">削除: </span>
        <span className="text-danger line-through">{changeDetail.deleted.content}</span>
      </div>
    );
  }

  // 並び替えの場合
  if (changeDetail.type === 'PRECONDITION_REORDER') {
    return (
      <p className="text-xs text-foreground-muted italic">前提条件の順序を変更しました</p>
    );
  }

  if (changeDetail.type === 'TEST_CASE_REORDER') {
    return (
      <p className="text-xs text-foreground-muted italic">テストケースの順序を変更しました</p>
    );
  }

  return null;
}

/**
 * 差分フィールド表示コンポーネント
 */
function DiffField({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="text-xs space-y-1">
      <p className="font-medium text-foreground-muted">{label}</p>
      <div className="pl-2 space-y-0.5">
        <p className="text-danger">
          <span className="line-through">{before}</span>
        </p>
        <p className="text-green-600">{after}</p>
      </div>
    </div>
  );
}

/**
 * 履歴アイテム
 */
function HistoryItem({ history }: { history: TestSuiteHistory }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const changeTypeDef = CHANGE_TYPES[history.changeType];
  const Icon = changeTypeDef.icon;
  const showDetailButton =
    (history.changeType === 'UPDATE' || history.changeType === 'CREATE') &&
    hasChangeDetail(history.snapshot);

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

            {/* サマリー表示 + 詳細ボタン */}
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-foreground-muted">
                {getChangeSummary(history.snapshot, history.changeType)}
              </p>
              {showDetailButton && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="inline-flex items-center gap-0.5 text-xs text-accent hover:underline"
                >
                  {isExpanded ? '閉じる' : '詳細を見る'}
                  <ChevronDown
                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
              )}
            </div>

            {/* 折りたたみ式差分表示 */}
            {isExpanded && (
              <div className="mt-2 pl-3 border-l-2 border-accent">
                <DiffView snapshot={history.snapshot} />
              </div>
            )}

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

/**
 * グループ化された履歴のサマリーを取得（カテゴリ別対応）
 */
function getGroupSummary(categorizedHistories: TestSuiteCategorizedHistories): string {
  const allHistories = [
    ...categorizedHistories.basicInfo,
    ...categorizedHistories.preconditions,
  ];
  const allChangedFields = allHistories.flatMap((h) => getChangedFields(h.snapshot));
  const uniqueFields = [...new Set(allChangedFields)];
  if (uniqueFields.length === 0) {
    return '複数の変更';
  }
  return `${uniqueFields.join('、')}を変更`;
}

/**
 * グループ化された履歴アイテム
 */
function HistoryGroupItem({ group }: { group: TestSuiteHistoryGroupedItem }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // グループ内の最初の履歴から変更者情報を取得
  const firstHistory = getFirstHistory(group.categorizedHistories);
  const changedBy = firstHistory?.changedBy ?? null;

  // グループ内のサマリー
  const summary = getGroupSummary(group.categorizedHistories);
  const totalCount = getTotalHistoryCount(group.categorizedHistories);

  // カテゴリ別に表示するためのリスト（空でないカテゴリのみ）
  const nonEmptyCategories = (
    Object.entries(group.categorizedHistories) as [keyof TestSuiteCategorizedHistories, TestSuiteHistory[]][]
  )
    .filter(([, histories]) => histories.length > 0)
    .sort(([a], [b]) => CATEGORY_DEFINITIONS[a].order - CATEGORY_DEFINITIONS[b].order);

  return (
    <div className="relative flex items-start gap-4 pl-8">
      {/* タイムラインドット - グループ用アイコン */}
      <div
        className="absolute left-0 w-8 h-8 rounded-full bg-background-secondary border-2 border-border flex items-center justify-center text-blue-500"
        role="img"
        aria-label="グループ更新"
      >
        <Layers className="w-4 h-4" aria-hidden="true" />
      </div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-start gap-3">
          {/* ユーザーアバター */}
          <div className="flex-shrink-0">
            {changedBy?.avatarUrl ? (
              <img
                src={changedBy.avatarUrl}
                alt={changedBy.name}
                className="w-8 h-8 rounded-full"
              />
            ) : changedBy ? (
              <div className="w-8 h-8 rounded-full bg-accent-subtle flex items-center justify-center">
                <span className="text-xs font-medium text-accent">
                  {changedBy.name.charAt(0).toUpperCase()}
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded text-blue-500 bg-background-tertiary">
                <Pencil className="w-3 h-3" />
                更新
                <span className="text-foreground-muted">
                  ({totalCount}件)
                </span>
              </span>

              {/* ユーザー名 */}
              <span className="text-sm text-foreground">
                {changedBy?.name || 'システム'}
              </span>
            </div>

            {/* サマリー表示 + 詳細ボタン */}
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-foreground-muted">{summary}</p>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-0.5 text-xs text-accent hover:underline"
              >
                {isExpanded ? '閉じる' : '詳細を見る'}
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* 折りたたみ式カテゴリ別差分表示 */}
            {isExpanded && (
              <div className="mt-2 pl-3 border-l-2 border-accent space-y-4">
                {nonEmptyCategories.map(([category, histories]) => {
                  const categoryDef = CATEGORY_DEFINITIONS[category];
                  const CategoryIcon = categoryDef.icon;
                  return (
                    <div key={category} className="space-y-2">
                      {/* カテゴリヘッダー */}
                      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                        <CategoryIcon className="w-3.5 h-3.5 text-foreground-muted" />
                        <span>{categoryDef.label}</span>
                        <span className="text-foreground-muted">({histories.length}件)</span>
                      </div>
                      {/* カテゴリ内の履歴 */}
                      <div className="space-y-2 pl-5">
                        {histories.map((history) => (
                          <div key={history.id} className="space-y-1">
                            <p className="text-xs text-foreground-muted">
                              {getChangeSummary(history.snapshot, history.changeType)}
                            </p>
                            <DiffView snapshot={history.snapshot} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 日時 */}
            <p className="mt-1 text-xs text-foreground-subtle">
              <span title={formatDateTime(group.createdAt)}>
                {formatRelativeTime(group.createdAt)}
              </span>
              <span className="hidden md:inline ml-2">
                ({formatDateTime(group.createdAt)})
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
