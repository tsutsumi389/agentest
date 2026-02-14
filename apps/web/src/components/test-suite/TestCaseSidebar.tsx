import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Loader2,
  Plus,
  GripVertical,
  Search,
  FileText,
  LayoutGrid,
  FileEdit,
  Archive,
  Trash2,
  RotateCcw,
  CircleDot,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { testSuitesApi, testCasesApi, ApiError, type TestCase, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';

/** ステータスフィルタの種類 */
export type TestCaseFilter = 'active' | 'draft' | 'archived' | 'deleted';

interface TestCaseSidebarProps {
  testSuiteId: string;
  testCases: TestCase[];
  selectedTestCaseId: string | null;
  onSelect: (testCaseId: string) => void;
  onCreateClick: () => void;
  currentRole?: 'OWNER' | ProjectMemberRole;
  isLoading?: boolean;
  onTestCasesReordered?: (reorderedTestCases: TestCase[]) => void;
  /** 作成モードかどうか */
  isCreateMode?: boolean;
  /** 概要表示中かどうか */
  isOverviewMode?: boolean;
  /** 概要ボタンクリック時のハンドラ */
  onOverviewClick?: () => void;
  /** 外部からフィルタを制御する場合 */
  activeFilter?: TestCaseFilter;
  /** フィルタ変更時のコールバック */
  onFilterChange?: (filter: TestCaseFilter) => void;
}

/**
 * 優先度スタイル
 */
const priorityStyles = {
  CRITICAL: { dot: 'bg-danger', label: '緊急' },
  HIGH: { dot: 'bg-warning', label: '高' },
  MEDIUM: { dot: 'bg-accent', label: '中' },
  LOW: { dot: 'bg-foreground-muted', label: '低' },
} as const;

/** ソフトデリートの猶予期間（日数） */
const SOFT_DELETE_RETENTION_DAYS = 30;

/** 残り日数の警告閾値（この日数以下で警告色表示） */
const REMAINING_DAYS_WARNING_THRESHOLD = 3;

/**
 * 削除済みテストケースの残り日数を計算
 */
function getRemainingDays(deletedAt: string | null | undefined): number {
  if (!deletedAt) return SOFT_DELETE_RETENTION_DAYS;
  const deletedDate = new Date(deletedAt);
  const expiryDate = new Date(deletedDate.getTime() + SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  const remaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, remaining);
}

/**
 * フィルタ定義
 */
const FILTER_DEFINITIONS: { key: TestCaseFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'active', label: 'アクティブ', icon: CircleDot },
  { key: 'draft', label: '下書き', icon: FileEdit },
  { key: 'archived', label: 'アーカイブ', icon: Archive },
  { key: 'deleted', label: 'ゴミ箱', icon: Trash2 },
];

/**
 * ソート可能なテストケースアイテム
 */
function SortableTestCaseItem({
  testCase,
  isSelected,
  canReorder,
  isReordering,
  onSelect,
  isDeletedFilter,
  onRestore,
}: {
  testCase: TestCase;
  isSelected: boolean;
  canReorder: boolean;
  isReordering: boolean;
  onSelect: () => void;
  isDeletedFilter?: boolean;
  onRestore?: (testCaseId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: testCase.id, disabled: !canReorder || isReordering || !!isDeletedFilter });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityStyles[testCase.priority];

  // ゴミ箱フィルタ時の残り日数
  const remainingDays = isDeletedFilter ? getRemainingDays(testCase.deletedAt) : null;
  const isWarning = remainingDays !== null && remainingDays <= REMAINING_DAYS_WARNING_THRESHOLD;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors
        ${isDragging ? 'opacity-50 shadow-lg z-10' : ''}
        ${isSelected
          ? 'bg-accent-subtle text-accent'
          : 'hover:bg-background-tertiary text-foreground'
        }
      `}
      onClick={onSelect}
    >
      {/* ドラッグハンドル（ゴミ箱フィルタ時は非表示） */}
      {canReorder && !isDeletedFilter && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none p-0.5 text-foreground-muted hover:text-foreground flex-shrink-0"
          aria-label="ドラッグして並び替え"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      )}

      {/* ゴミ箱アイコン（ゴミ箱フィルタ時） */}
      {isDeletedFilter && (
        <Trash2 className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />
      )}

      {/* 優先度ドット（ゴミ箱フィルタ時は非表示） */}
      {!isDeletedFilter && (
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`}
          title={priority.label}
        />
      )}

      {/* タイトル */}
      <span className="text-sm truncate flex-1">
        {testCase.title}
      </span>

      {/* 残り日数バッジ（ゴミ箱フィルタ時） */}
      {remainingDays !== null && (
        <span className={`text-xs flex-shrink-0 ${isWarning ? 'text-warning' : 'text-foreground-muted'}`}>
          残り{remainingDays}日
        </span>
      )}

      {/* 復元ボタン（ゴミ箱フィルタ時） */}
      {isDeletedFilter && onRestore && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRestore(testCase.id);
          }}
          className="p-1 text-foreground-muted hover:text-accent rounded transition-colors flex-shrink-0"
          aria-label="復元"
          title="復元"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/**
 * テストケースサイドバーコンポーネント
 */
export function TestCaseSidebar({
  testSuiteId,
  testCases,
  selectedTestCaseId,
  onSelect,
  onCreateClick,
  currentRole,
  isLoading = false,
  onTestCasesReordered,
  isCreateMode = false,
  isOverviewMode = false,
  onOverviewClick,
  activeFilter: externalFilter,
  onFilterChange,
}: TestCaseSidebarProps) {
  const queryClient = useQueryClient();
  const [internalFilter, setInternalFilter] = useState<TestCaseFilter>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [localTestCases, setLocalTestCases] = useState<TestCase[]>([]);

  // 外部制御かローカル制御かを判定
  const currentFilter = externalFilter ?? internalFilter;
  const isDeletedFilter = currentFilter === 'deleted';

  // 検索フィルタ適用中かどうか
  const isSearching = searchQuery.trim().length > 0;

  // 権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';
  // 検索中またはゴミ箱フィルタ時は並び替えを無効化
  const canReorder = canEdit && !isSearching && !isDeletedFilter;

  // dnd-kit センサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // orderKeyでソート
  const sortedTestCases = [...testCases].sort((a, b) => a.orderKey.localeCompare(b.orderKey));

  // ローカルの状態があればそれを使用、なければpropsのデータを使用
  const displayTestCases = localTestCases.length > 0 ? localTestCases : sortedTestCases;

  // 検索フィルタリング
  const filteredTestCases = isSearching
    ? displayTestCases.filter((tc) => {
        const query = searchQuery.toLowerCase();
        return (
          tc.title.toLowerCase().includes(query) ||
          (tc.description?.toLowerCase().includes(query) ?? false)
        );
      })
    : displayTestCases;

  // フィルタ変更ハンドラ
  const handleFilterChange = (filter: TestCaseFilter) => {
    if (onFilterChange) {
      onFilterChange(filter);
    } else {
      setInternalFilter(filter);
    }
  };

  // テストケース復元ハンドラ
  const handleRestore = async (testCaseId: string) => {
    try {
      await testCasesApi.restore(testCaseId);
      toast.success('テストケースを復元しました');
      // ゴミ箱・アクティブフィルタの両方のキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: ['test-suite-cases', testSuiteId] });
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('テストケースの復元に失敗しました');
      }
    }
  };

  // ドラッグ終了時のハンドラー
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = displayTestCases.findIndex((tc) => tc.id === active.id);
    const newIndex = displayTestCases.findIndex((tc) => tc.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 配列を並び替え（オプティミスティック更新）
    const newTestCases = arrayMove(displayTestCases, oldIndex, newIndex);
    setLocalTestCases(newTestCases);
    setIsReordering(true);

    // APIで永続化
    try {
      const testCaseIds = newTestCases.map((tc) => tc.id);
      const response = await testSuitesApi.reorderTestCases(testSuiteId, testCaseIds);
      // サーバーから返された順序で更新
      const reorderedTestCases = response.testCases.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
      setLocalTestCases(reorderedTestCases);
      // 親コンポーネントに通知
      onTestCasesReordered?.(reorderedTestCases);
    } catch (err) {
      // エラー時は元に戻す
      setLocalTestCases([]);
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('並び順の更新に失敗しました');
      }
    } finally {
      setIsReordering(false);
    }
  };

  // propsのtestCasesが変更されたらローカル状態をリセット
  useEffect(() => {
    if (!isReordering) {
      setLocalTestCases([]);
    }
  }, [testCases, isReordering]);

  // 空メッセージの出し分け
  const emptyMessage = isDeletedFilter
    ? '削除済みテストケースはありません'
    : isSearching
      ? '検索結果がありません'
      : 'テストケースがありません';

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー */}
      <div className="p-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            テストケース
            {isReordering && (
              <Loader2 className="w-3 h-3 animate-spin text-foreground-muted" />
            )}
          </h3>
          {canEdit && (
            <button
              onClick={onCreateClick}
              className={`p-1.5 rounded transition-colors ${
                isCreateMode
                  ? 'text-accent bg-accent-subtle'
                  : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
              }`}
              aria-label="テストケースを追加"
              disabled={isReordering}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

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

        {/* ステータスフィルタ */}
        <div className="flex items-center gap-1">
          {FILTER_DEFINITIONS.map((filter) => {
            const isActive = currentFilter === filter.key;
            const Icon = filter.icon;
            return (
              <div key={filter.key} className="relative group">
                <button
                  type="button"
                  onClick={() => handleFilterChange(filter.key)}
                  aria-label={filter.label}
                  aria-pressed={isActive}
                  className={`
                    p-1.5 rounded-full transition-colors
                    ${isActive
                      ? 'bg-accent-subtle text-accent'
                      : 'text-foreground-muted hover:text-foreground hover:bg-background-tertiary'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                </button>
                {/* ツールチップ */}
                <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 px-2 py-1 text-xs text-foreground bg-background-secondary border border-border rounded shadow-md whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-[var(--z-tooltip)]">
                  {filter.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 概要ボタン */}
      {onOverviewClick && (
        <div className="p-2 border-b border-border">
          <button
            type="button"
            onClick={onOverviewClick}
            aria-label="テストスイート概要を表示"
            className={`
              w-full flex items-center gap-2 p-2 rounded-md text-left transition-colors
              ${isOverviewMode
                ? 'bg-accent-subtle text-accent'
                : 'hover:bg-background-tertiary text-foreground'
              }
            `}
          >
            <LayoutGrid className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium flex-1">概要</span>
          </button>
        </div>
      )}

      {/* テストケース一覧 */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
          </div>
        ) : filteredTestCases.length === 0 ? (
          <div className="text-center py-8">
            {isDeletedFilter ? (
              <Trash2 className="w-10 h-10 text-foreground-subtle mx-auto mb-3" />
            ) : (
              <FileText className="w-10 h-10 text-foreground-subtle mx-auto mb-3" />
            )}
            <p className="text-sm text-foreground-muted">
              {emptyMessage}
            </p>
            {!isSearching && !isDeletedFilter && canEdit && (
              <button
                onClick={onCreateClick}
                className="mt-3 text-sm text-accent hover:text-accent-hover"
              >
                テストケースを作成
              </button>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredTestCases.map((tc) => tc.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {filteredTestCases.map((testCase) => (
                  <SortableTestCaseItem
                    key={testCase.id}
                    testCase={testCase}
                    isSelected={selectedTestCaseId === testCase.id}
                    canReorder={canReorder}
                    isReordering={isReordering}
                    onSelect={() => onSelect(testCase.id)}
                    isDeletedFilter={isDeletedFilter}
                    onRestore={isDeletedFilter ? handleRestore : undefined}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
