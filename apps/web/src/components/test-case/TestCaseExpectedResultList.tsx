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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Loader2,
  Plus,
  CheckCircle,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCaseExpectedResult, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SortableListItem } from '../common/SortableListItem';
import { TestCaseItemFormModal } from './TestCaseItemFormModal';

interface TestCaseExpectedResultListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialExpectedResults?: TestCaseExpectedResult[];
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | ProjectMemberRole;
  /** 更新時のコールバック */
  onUpdated?: () => void;
}

/**
 * テストケース期待結果一覧コンポーネント
 */
export function TestCaseExpectedResultList({
  testCaseId,
  initialExpectedResults,
  currentRole,
  onUpdated,
}: TestCaseExpectedResultListProps) {
  const [expectedResults, setExpectedResults] = useState<TestCaseExpectedResult[]>(initialExpectedResults || []);
  const [isLoading, setIsLoading] = useState(!initialExpectedResults);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingExpectedResult, setEditingExpectedResult] = useState<TestCaseExpectedResult | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    expectedResult: TestCaseExpectedResult;
  } | null>(null);

  const [isReordering, setIsReordering] = useState(false);

  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';
  const canDelete = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

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

  useEffect(() => {
    if (initialExpectedResults) {
      setExpectedResults(initialExpectedResults);
      return;
    }

    const fetchExpectedResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await testCasesApi.getExpectedResults(testCaseId);
        const sorted = response.expectedResults.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        setExpectedResults(sorted);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('期待結果一覧の取得に失敗しました');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpectedResults();
  }, [testCaseId, initialExpectedResults]);

  const handleOpenCreate = () => {
    setEditingExpectedResult(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (expectedResult: TestCaseExpectedResult) => {
    setEditingExpectedResult(expectedResult);
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (content: string) => {
    setIsSubmitting(true);

    try {
      if (editingExpectedResult) {
        const response = await testCasesApi.updateExpectedResult(testCaseId, editingExpectedResult.id, { content });
        setExpectedResults((prev) =>
          prev.map((e) => (e.id === editingExpectedResult.id ? response.expectedResult : e))
        );
        toast.success('期待結果を更新しました');
      } else {
        const response = await testCasesApi.addExpectedResult(testCaseId, { content });
        setExpectedResults((prev) =>
          [...prev, response.expectedResult].sort((a, b) => a.orderKey.localeCompare(b.orderKey))
        );
        toast.success('期待結果を追加しました');
      }
      onUpdated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(err.message);
      }
      throw new Error(editingExpectedResult ? '期待結果の更新に失敗しました' : '期待結果の追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDelete = (expectedResult: TestCaseExpectedResult) => {
    setDeleteConfirm({ expectedResult });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    const expectedResult = deleteConfirm.expectedResult;
    setUpdatingId(expectedResult.id);

    try {
      await testCasesApi.deleteExpectedResult(testCaseId, expectedResult.id);
      setExpectedResults((prev) => prev.filter((e) => e.id !== expectedResult.id));
      toast.success('期待結果を削除しました');
      onUpdated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('期待結果の削除に失敗しました');
      }
    } finally {
      setUpdatingId(null);
      setDeleteConfirm(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = expectedResults.findIndex((e) => e.id === active.id);
    const newIndex = expectedResults.findIndex((e) => e.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newExpectedResults = arrayMove(expectedResults, oldIndex, newIndex);
    setExpectedResults(newExpectedResults);
    setIsReordering(true);

    try {
      const expectedResultIds = newExpectedResults.map((e) => e.id);
      const response = await testCasesApi.reorderExpectedResults(testCaseId, expectedResultIds);
      setExpectedResults(response.expectedResults.sort((a, b) => a.orderKey.localeCompare(b.orderKey)));
      onUpdated?.();
    } catch (err) {
      try {
        const response = await testCasesApi.getExpectedResults(testCaseId);
        setExpectedResults(response.expectedResults.sort((a, b) => a.orderKey.localeCompare(b.orderKey)));
      } catch {
        // 無視
      }
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('並び順の更新に失敗しました');
      }
    } finally {
      setIsReordering(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">期待結果</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">期待結果</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-danger text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">期待結果</h3>
          {isReordering && (
            <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
          )}
        </div>
        {canEdit && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleOpenCreate}
            disabled={isReordering}
          >
            <Plus className="w-3 h-3" />
            追加
          </button>
        )}
      </div>

      {expectedResults.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
          <CheckCircle className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
          <p className="text-foreground-muted text-sm mb-3">期待結果が設定されていません</p>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
              <Plus className="w-3 h-3" />
              期待結果を追加
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
            items={expectedResults.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {expectedResults.map((expectedResult, index) => (
                <SortableListItem
                  key={expectedResult.id}
                  id={expectedResult.id}
                  index={index + 1}
                  content={expectedResult.content}
                  indexColor="success"
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={() => handleOpenEdit(expectedResult)}
                  onDelete={() => handleRequestDelete(expectedResult)}
                  isUpdating={updatingId === expectedResult.id}
                  isReordering={isReordering}
                  actionAriaLabel="期待結果操作メニュー"
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <TestCaseItemFormModal
        isOpen={isFormModalOpen}
        title={editingExpectedResult ? '期待結果を編集' : '期待結果を追加'}
        placeholder="例: ダッシュボード画面が表示される"
        helpText="テスト実行後に期待される結果を記述してください"
        initialValue={editingExpectedResult?.content}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingExpectedResult(null);
        }}
      />

      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="期待結果を削除"
          message="この期待結果を削除しますか？この操作は取り消せません。"
          confirmLabel="削除する"
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
          isLoading={updatingId !== null}
          isDanger
        />
      )}
    </div>
  );
}
