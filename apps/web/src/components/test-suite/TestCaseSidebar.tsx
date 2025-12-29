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
} from 'lucide-react';
import { testSuitesApi, ApiError, type TestCase, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';

interface TestCaseSidebarProps {
  testSuiteId: string;
  testCases: TestCase[];
  selectedTestCaseId: string | null;
  onSelect: (testCaseId: string) => void;
  onCreateClick: () => void;
  currentRole?: 'OWNER' | ProjectMemberRole;
  isLoading?: boolean;
  onTestCasesReordered?: (reorderedTestCases: TestCase[]) => void;
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

/**
 * ソート可能なテストケースアイテム
 */
function SortableTestCaseItem({
  testCase,
  isSelected,
  canReorder,
  isReordering,
  onSelect,
}: {
  testCase: TestCase;
  isSelected: boolean;
  canReorder: boolean;
  isReordering: boolean;
  onSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: testCase.id, disabled: !canReorder || isReordering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priority = priorityStyles[testCase.priority];

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
      {/* ドラッグハンドル */}
      {canReorder && (
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

      {/* 優先度ドット */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${priority.dot}`}
        title={priority.label}
      />

      {/* タイトル */}
      <span className="text-sm truncate flex-1">
        {testCase.title}
      </span>
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
}: TestCaseSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [localTestCases, setLocalTestCases] = useState<TestCase[]>([]);

  // 検索フィルタ適用中かどうか
  const isSearching = searchQuery.trim().length > 0;

  // 権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';
  // 検索中は並び替えを無効化
  const canReorder = canEdit && !isSearching;

  // dnd-kit センサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px以上動かしたらドラッグ開始
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
              className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
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
            {!isSearching && canEdit && (
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
