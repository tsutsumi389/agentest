import { useState, useMemo } from 'react';
import {
  Loader2,
  Search,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  CircleDot,
  LayoutGrid,
} from 'lucide-react';
import type {
  ExecutionTestCaseSnapshot,
  ExecutionExpectedResult,
} from '../../lib/api';
import { priorityStyles } from './constants';

interface ExecutionSidebarProps {
  /** 実行時テストケース一覧 */
  testCases: ExecutionTestCaseSnapshot[];
  /** 選択中のテストケースID */
  selectedTestCaseId: string | null;
  /** テストケース選択ハンドラ（nullで概要表示） */
  onSelect: (testCaseId: string | null) => void;
  /** 全期待結果（進捗計算用） */
  allExpectedResults: ExecutionExpectedResult[];
  /** ローディング状態 */
  isLoading?: boolean;
}

/** テストケースの進捗状態 */
type ProgressStatus = 'pass' | 'fail' | 'pending' | 'mixed';

/**
 * テストケースの進捗を計算
 */
function calculateProgress(
  testCaseId: string,
  allExpectedResults: ExecutionExpectedResult[]
): { status: ProgressStatus; passCount: number; failCount: number; pendingCount: number; total: number } {
  const results = allExpectedResults.filter((r) => r.executionTestCaseId === testCaseId);
  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const pendingCount = results.filter(
    (r) => r.status === 'PENDING' || r.status === 'SKIPPED' || r.status === 'NOT_EXECUTABLE'
  ).length;
  const total = results.length;

  // 進捗ステータスを決定
  let status: ProgressStatus = 'pending';
  if (total === 0) {
    status = 'pending';
  } else if (failCount > 0) {
    status = 'fail';
  } else if (passCount === total) {
    status = 'pass';
  } else if (passCount > 0) {
    // FAILがなくPASSが1つ以上あるが全PASSではない = mixed
    status = 'mixed';
  }

  return { status, passCount, failCount, pendingCount, total };
}

/**
 * 進捗インジケーター
 */
function ProgressIndicator({ status }: { status: ProgressStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />;
    case 'fail':
      return <XCircle className="w-4 h-4 text-danger flex-shrink-0" />;
    case 'mixed':
      return <CircleDot className="w-4 h-4 text-warning flex-shrink-0" />;
    case 'pending':
    default:
      return <Clock className="w-4 h-4 text-foreground-muted flex-shrink-0" />;
  }
}

/**
 * テストケースアイテム
 */
function TestCaseItem({
  testCase,
  isSelected,
  progress,
  onSelect,
}: {
  testCase: ExecutionTestCaseSnapshot;
  isSelected: boolean;
  progress: ReturnType<typeof calculateProgress>;
  onSelect: () => void;
}) {
  const priority = priorityStyles[testCase.priority] || priorityStyles.MEDIUM;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors
        ${isSelected
          ? 'bg-accent-subtle text-accent'
          : 'hover:bg-background-tertiary text-foreground'
        }
      `}
    >
      {/* 進捗インジケーター */}
      <ProgressIndicator status={progress.status} />

      {/* 優先度ドット */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`}
        title={priority.label}
      />

      {/* タイトル */}
      <span className="text-sm truncate flex-1">
        {testCase.title}
      </span>

      {/* 進捗カウント */}
      {progress.total > 0 && (
        <span className="text-xs text-foreground-muted flex-shrink-0">
          {progress.passCount}/{progress.total}
        </span>
      )}
    </button>
  );
}

/**
 * 実行画面用サイドバー
 * テストケース一覧と進捗を表示
 */
export function ExecutionSidebar({
  testCases,
  selectedTestCaseId,
  onSelect,
  allExpectedResults,
  isLoading = false,
}: ExecutionSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 検索フィルタ適用中かどうか
  const isSearching = searchQuery.trim().length > 0;

  // orderKeyでソート
  const sortedTestCases = useMemo(
    () => [...testCases].sort((a, b) => a.orderKey.localeCompare(b.orderKey)),
    [testCases]
  );

  // 検索フィルタリング
  const filteredTestCases = useMemo(() => {
    if (!isSearching) return sortedTestCases;
    const query = searchQuery.toLowerCase();
    return sortedTestCases.filter((tc) =>
      tc.title.toLowerCase().includes(query) ||
      (tc.description?.toLowerCase().includes(query) ?? false)
    );
  }, [sortedTestCases, searchQuery, isSearching]);

  // 進捗キャッシュ
  const progressMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof calculateProgress>>();
    for (const tc of testCases) {
      map.set(tc.id, calculateProgress(tc.id, allExpectedResults));
    }
    return map;
  }, [testCases, allExpectedResults]);

  // 全体サマリー
  const overallSummary = useMemo(() => {
    let totalPass = 0;
    let totalFail = 0;
    let totalPending = 0;
    for (const progress of progressMap.values()) {
      totalPass += progress.passCount;
      totalFail += progress.failCount;
      totalPending += progress.pendingCount;
    }
    return { pass: totalPass, fail: totalFail, pending: totalPending };
  }, [progressMap]);

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="p-3 border-b border-border space-y-3">
        <h3 className="font-semibold text-foreground text-sm">
          テストケース
        </h3>

        {/* 検索ボックス */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="検索..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          />
        </div>
      </div>

      {/* 概要ボタン */}
      <div className="p-2 border-b border-border">
        <button
          type="button"
          onClick={() => onSelect(null)}
          aria-label="テストスイート概要を表示"
          className={`
            w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors
            ${selectedTestCaseId === null
              ? 'bg-accent-subtle text-accent'
              : 'hover:bg-background-tertiary text-foreground'
            }
          `}
        >
          <LayoutGrid className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium flex-1">概要</span>
          {/* サマリーバッジ */}
          <div className="flex items-center gap-1 text-xs">
            {overallSummary.pass > 0 && (
              <span className="text-success">{overallSummary.pass}</span>
            )}
            {overallSummary.fail > 0 && (
              <span className="text-danger">{overallSummary.fail}</span>
            )}
            {overallSummary.pending > 0 && (
              <span className="text-foreground-muted">{overallSummary.pending}</span>
            )}
          </div>
        </button>
      </div>

      {/* テストケース一覧 */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
          </div>
        ) : filteredTestCases.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-foreground-subtle mx-auto mb-3" />
            <p className="text-sm text-foreground-muted">
              {isSearching ? '検索結果がありません' : 'テストケースがありません'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredTestCases.map((testCase) => (
              <TestCaseItem
                key={testCase.id}
                testCase={testCase}
                isSelected={selectedTestCaseId === testCase.id}
                progress={progressMap.get(testCase.id) || { status: 'pending', passCount: 0, failCount: 0, pendingCount: 0, total: 0 }}
                onSelect={() => onSelect(testCase.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* フッター（件数表示） */}
      <div className="p-2 border-t border-border">
        <p className="text-xs text-foreground-muted text-center">
          {isSearching
            ? `${filteredTestCases.length} / ${testCases.length} 件`
            : `${testCases.length} 件`}
        </p>
      </div>
    </div>
  );
}
