import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import {
  testCasesApi,
  ApiError,
  type TestCase,
  type TestCaseHistory,
  type TestCaseHistoryGroup,
  type TestCaseChangeType,
} from '../../lib/api';
import { type TestCaseChangeDetail } from '@agentest/shared';
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
 * 履歴をグループ化する
 * groupIdがある履歴は同じグループにまとめ、groupIdがない履歴は個別に表示
 */
function groupHistories(
  histories: TestCaseHistory[]
): (TestCaseHistory | TestCaseHistoryGroup)[] {
  const result: (TestCaseHistory | TestCaseHistoryGroup)[] = [];
  const groupMap = new Map<string, TestCaseHistory[]>();

  for (const history of histories) {
    if (history.groupId) {
      // groupIdがある場合はグループ化
      const group = groupMap.get(history.groupId) || [];
      group.push(history);
      groupMap.set(history.groupId, group);
    } else {
      // groupIdがない場合は個別表示
      result.push(history);
    }
  }

  // グループをresultに追加
  for (const [groupId, group] of groupMap) {
    // グループ内に複数の履歴がある場合のみグループとして扱う
    // 単一の履歴の場合は個別表示
    if (group.length > 1) {
      result.push({
        groupId,
        histories: group,
        createdAt: group[0].createdAt,
      });
    } else {
      result.push(group[0]);
    }
  }

  // createdAtでソート（降順 - 新しいものが上）
  return result.sort((a, b) => {
    const aDate = 'histories' in a ? a.createdAt : a.createdAt;
    const bDate = 'histories' in b ? b.createdAt : b.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });
}

/**
 * グループかどうかを判定
 */
function isHistoryGroup(
  item: TestCaseHistory | TestCaseHistoryGroup
): item is TestCaseHistoryGroup {
  return 'histories' in item && Array.isArray(item.histories);
}

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

  // グループ化した履歴
  const groupedItems = useMemo(() => groupHistories(histories), [histories]);

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
          <p className="text-foreground-muted text-sm">履歴の読み込みに失敗しました</p>
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
                {groupedItems.map((item) =>
                  isHistoryGroup(item) ? (
                    <HistoryGroupItem key={item.groupId} group={item} />
                  ) : (
                    <HistoryItem key={item.id} history={item} />
                  )
                )}
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
 * フィールド名のラベル
 */
const FIELD_LABELS: Record<string, string> = {
  title: 'タイトル',
  description: '説明',
  priority: '優先度',
  status: 'ステータス',
};

/**
 * 優先度のラベル
 */
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: '緊急',
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
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
  const changeDetail = snapshot.changeDetail as TestCaseChangeDetail | undefined;
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
    case 'STEP_ADD':
      return ['ステップ（追加）'];
    case 'STEP_UPDATE':
      return ['ステップ'];
    case 'STEP_DELETE':
      return ['ステップ（削除）'];
    case 'STEP_REORDER':
      return ['ステップ（並び替え）'];
    case 'EXPECTED_RESULT_ADD':
      return ['期待結果（追加）'];
    case 'EXPECTED_RESULT_UPDATE':
      return ['期待結果'];
    case 'EXPECTED_RESULT_DELETE':
      return ['期待結果（削除）'];
    case 'EXPECTED_RESULT_REORDER':
      return ['期待結果（並び替え）'];
    case 'COPY':
      return ['コピー'];
    default:
      return [];
  }
}

/**
 * changeDetailが存在するか確認
 */
function hasTestCaseChangeDetail(snapshot: Record<string, unknown>): boolean {
  return snapshot.changeDetail != null;
}

/**
 * 変更内容のサマリーを取得
 */
function getChangeSummary(snapshot: Record<string, unknown>, changeType: TestCaseChangeType): string {
  if (changeType === 'CREATE') {
    const changeDetail = snapshot.changeDetail as TestCaseChangeDetail | undefined;
    if (changeDetail?.type === 'COPY') {
      return `「${changeDetail.sourceTitle}」からコピーして作成`;
    }
    return 'テストケースを作成';
  }

  if (changeType === 'DELETE') {
    return 'テストケースを削除';
  }

  if (changeType === 'RESTORE') {
    return 'テストケースを復元';
  }

  // UPDATEの場合
  const changedFields = getChangedFields(snapshot);
  if (changedFields.length > 0) {
    return `${changedFields.join('、')}を変更`;
  }

  // changeDetailがない古いデータの場合（後方互換性）
  const changes: string[] = [];
  if (snapshot.title !== undefined) changes.push('タイトル');
  if (snapshot.description !== undefined) changes.push('説明');
  if (snapshot.priority !== undefined) changes.push('優先度');
  if (snapshot.status !== undefined) changes.push('ステータス');
  if (snapshot.preconditions !== undefined) changes.push('前提条件');
  if (snapshot.steps !== undefined) changes.push('ステップ');
  if (snapshot.expectedResults !== undefined) changes.push('期待結果');

  return changes.length > 0 ? `${changes.join('、')}を変更` : '設定を更新';
}

/**
 * 差分表示コンポーネント
 */
function DiffView({ snapshot }: { snapshot: Record<string, unknown> }) {
  const changeDetail = snapshot.changeDetail as TestCaseChangeDetail | undefined;

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
        {fields.title && (
          <DiffField
            label="タイトル"
            before={fields.title.before}
            after={fields.title.after}
          />
        )}
        {fields.description && (
          <DiffField
            label="説明"
            before={fields.description.before || '（なし）'}
            after={fields.description.after || '（なし）'}
          />
        )}
        {fields.priority && (
          <DiffField
            label="優先度"
            before={PRIORITY_LABELS[fields.priority.before] || fields.priority.before}
            after={PRIORITY_LABELS[fields.priority.after] || fields.priority.after}
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

  // ステップの変更
  if (changeDetail.type === 'STEP_UPDATE') {
    return (
      <DiffField
        label="ステップ"
        before={changeDetail.before.content}
        after={changeDetail.after.content}
      />
    );
  }

  if (changeDetail.type === 'STEP_ADD') {
    return (
      <div className="text-xs">
        <span className="text-foreground-muted">追加: </span>
        <span className="text-green-600">{changeDetail.added.content}</span>
      </div>
    );
  }

  if (changeDetail.type === 'STEP_DELETE') {
    return (
      <div className="text-xs">
        <span className="text-foreground-muted">削除: </span>
        <span className="text-danger line-through">{changeDetail.deleted.content}</span>
      </div>
    );
  }

  // 期待結果の変更
  if (changeDetail.type === 'EXPECTED_RESULT_UPDATE') {
    return (
      <DiffField
        label="期待結果"
        before={changeDetail.before.content}
        after={changeDetail.after.content}
      />
    );
  }

  if (changeDetail.type === 'EXPECTED_RESULT_ADD') {
    return (
      <div className="text-xs">
        <span className="text-foreground-muted">追加: </span>
        <span className="text-green-600">{changeDetail.added.content}</span>
      </div>
    );
  }

  if (changeDetail.type === 'EXPECTED_RESULT_DELETE') {
    return (
      <div className="text-xs">
        <span className="text-foreground-muted">削除: </span>
        <span className="text-danger line-through">{changeDetail.deleted.content}</span>
      </div>
    );
  }

  // 並び替えの場合
  if (
    changeDetail.type === 'PRECONDITION_REORDER' ||
    changeDetail.type === 'STEP_REORDER' ||
    changeDetail.type === 'EXPECTED_RESULT_REORDER'
  ) {
    return (
      <p className="text-xs text-foreground-muted italic">順序を変更しました</p>
    );
  }

  // COPYの場合
  if (changeDetail.type === 'COPY') {
    return (
      <p className="text-xs text-foreground-muted">
        コピー元: 「{changeDetail.sourceTitle}」
      </p>
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
function HistoryItem({ history }: { history: TestCaseHistory }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const changeTypeDef = CHANGE_TYPES[history.changeType];
  const Icon = changeTypeDef.icon;
  const showDetailButton =
    (history.changeType === 'UPDATE' || history.changeType === 'CREATE') &&
    hasTestCaseChangeDetail(history.snapshot);

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

            {/* サマリー表示 + 詳細ボタン */}
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-foreground-muted">
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

/**
 * グループ化された履歴のサマリーを取得
 */
function getGroupSummary(histories: TestCaseHistory[]): string {
  const allChangedFields = histories.flatMap((h) => getChangedFields(h.snapshot));
  const uniqueFields = [...new Set(allChangedFields)];
  if (uniqueFields.length === 0) {
    return '複数の変更';
  }
  return `${uniqueFields.join('、')}を変更`;
}

/**
 * グループ化された履歴アイテム
 */
function HistoryGroupItem({ group }: { group: TestCaseHistoryGroup }) {
  const [isExpanded, setIsExpanded] = useState(false);

  // グループ内の最初の履歴から変更者情報を取得
  const firstHistory = group.histories[0];
  const changedBy = firstHistory.changedBy;

  // グループ内のサマリー
  const summary = getGroupSummary(group.histories);

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
                className="w-6 h-6 rounded-full"
              />
            ) : changedBy ? (
              <div className="w-6 h-6 rounded-full bg-accent-subtle flex items-center justify-center">
                <span className="text-xs font-medium text-accent">
                  {changedBy.name.charAt(0).toUpperCase()}
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
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded text-blue-500 bg-background-tertiary">
                <Pencil className="w-3 h-3" />
                更新
                <span className="text-foreground-muted">
                  ({group.histories.length}件)
                </span>
              </span>

              {/* ユーザー名 */}
              <span className="text-xs text-foreground">
                {changedBy?.name || 'システム'}
              </span>
            </div>

            {/* サマリー表示 + 詳細ボタン */}
            <div className="mt-1 flex items-center gap-2">
              <p className="text-xs text-foreground-muted">{summary}</p>
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

            {/* 折りたたみ式差分表示 */}
            {isExpanded && (
              <div className="mt-2 pl-3 border-l-2 border-accent space-y-3">
                {group.histories.map((history) => (
                  <div key={history.id} className="space-y-1">
                    <p className="text-xs font-medium text-foreground-muted">
                      {getChangeSummary(history.snapshot, history.changeType)}
                    </p>
                    <DiffView snapshot={history.snapshot} />
                  </div>
                ))}
              </div>
            )}

            {/* 日時 */}
            <p className="mt-1 text-xs text-foreground-subtle">
              <span title={formatDateTime(group.createdAt)}>
                {formatRelativeTime(group.createdAt)}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
