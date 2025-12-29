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
  ClipboardList,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCasePrecondition, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SortableListItem } from '../common/SortableListItem';
import { TestCaseItemFormModal } from './TestCaseItemFormModal';

interface TestCasePreconditionListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialPreconditions?: TestCasePrecondition[];
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | ProjectMemberRole;
  /** 更新時のコールバック */
  onUpdated?: () => void;
}

/**
 * テストケース前提条件一覧コンポーネント
 */
export function TestCasePreconditionList({
  testCaseId,
  initialPreconditions,
  currentRole,
  onUpdated,
}: TestCasePreconditionListProps) {
  const [preconditions, setPreconditions] = useState<TestCasePrecondition[]>(initialPreconditions || []);
  const [isLoading, setIsLoading] = useState(!initialPreconditions);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // モーダル状態
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPrecondition, setEditingPrecondition] = useState<TestCasePrecondition | null>(null);

  // 確認ダイアログ状態
  const [deleteConfirm, setDeleteConfirm] = useState<{
    precondition: TestCasePrecondition;
  } | null>(null);

  // 並び替え中状態
  const [isReordering, setIsReordering] = useState(false);

  // 権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';
  const canDelete = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

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

  // 前提条件一覧を取得
  useEffect(() => {
    if (initialPreconditions) {
      setPreconditions(initialPreconditions);
      return;
    }

    const fetchPreconditions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await testCasesApi.getPreconditions(testCaseId);
        const sorted = response.preconditions.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        setPreconditions(sorted);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('前提条件一覧の取得に失敗しました');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreconditions();
  }, [testCaseId, initialPreconditions]);

  // 新規作成モーダルを開く
  const handleOpenCreate = () => {
    setEditingPrecondition(null);
    setIsFormModalOpen(true);
  };

  // 編集モーダルを開く
  const handleOpenEdit = (precondition: TestCasePrecondition) => {
    setEditingPrecondition(precondition);
    setIsFormModalOpen(true);
  };

  // 作成・更新ハンドラ
  const handleSubmit = async (content: string) => {
    setIsSubmitting(true);

    try {
      if (editingPrecondition) {
        // 更新
        const response = await testCasesApi.updatePrecondition(
          testCaseId,
          editingPrecondition.id,
          { content }
        );
        setPreconditions((prev) =>
          prev.map((p) => (p.id === editingPrecondition.id ? response.precondition : p))
        );
        toast.success('前提条件を更新しました');
      } else {
        // 作成
        const response = await testCasesApi.addPrecondition(testCaseId, { content });
        setPreconditions((prev) =>
          [...prev, response.precondition].sort((a, b) => a.orderKey.localeCompare(b.orderKey))
        );
        toast.success('前提条件を追加しました');
      }
      onUpdated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(err.message);
      }
      throw new Error(editingPrecondition ? '前提条件の更新に失敗しました' : '前提条件の追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 削除確認
  const handleRequestDelete = (precondition: TestCasePrecondition) => {
    setDeleteConfirm({ precondition });
  };

  // 削除実行
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    const precondition = deleteConfirm.precondition;
    setUpdatingId(precondition.id);

    try {
      await testCasesApi.deletePrecondition(testCaseId, precondition.id);
      setPreconditions((prev) => prev.filter((p) => p.id !== precondition.id));
      toast.success('前提条件を削除しました');
      onUpdated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('前提条件の削除に失敗しました');
      }
    } finally {
      setUpdatingId(null);
      setDeleteConfirm(null);
    }
  };

  // ドラッグ終了時のハンドラー
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = preconditions.findIndex((p) => p.id === active.id);
    const newIndex = preconditions.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // 配列を並び替え（オプティミスティック更新）
    const newPreconditions = arrayMove(preconditions, oldIndex, newIndex);
    setPreconditions(newPreconditions);
    setIsReordering(true);

    // APIで永続化
    try {
      const preconditionIds = newPreconditions.map((p) => p.id);
      const response = await testCasesApi.reorderPreconditions(testCaseId, preconditionIds);
      setPreconditions(response.preconditions.sort((a, b) => a.orderKey.localeCompare(b.orderKey)));
      onUpdated?.();
    } catch (err) {
      // エラー時は再取得
      try {
        const response = await testCasesApi.getPreconditions(testCaseId);
        setPreconditions(response.preconditions.sort((a, b) => a.orderKey.localeCompare(b.orderKey)));
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
          <h3 className="text-sm font-semibold text-foreground">前提条件</h3>
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
          <h3 className="text-sm font-semibold text-foreground">前提条件</h3>
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
          <h3 className="text-sm font-semibold text-foreground">前提条件</h3>
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

      {preconditions.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
          <ClipboardList className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
          <p className="text-foreground-muted text-sm mb-3">前提条件が設定されていません</p>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
              <Plus className="w-3 h-3" />
              前提条件を追加
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
            items={preconditions.map((p) => p.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {preconditions.map((precondition, index) => (
                <SortableListItem
                  key={precondition.id}
                  id={precondition.id}
                  index={index + 1}
                  content={precondition.content}
                  indexColor="default"
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={() => handleOpenEdit(precondition)}
                  onDelete={() => handleRequestDelete(precondition)}
                  isUpdating={updatingId === precondition.id}
                  isReordering={isReordering}
                  actionAriaLabel="前提条件操作メニュー"
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* フォームモーダル */}
      <TestCaseItemFormModal
        isOpen={isFormModalOpen}
        title={editingPrecondition ? '前提条件を編集' : '前提条件を追加'}
        placeholder="例: ユーザーがログイン済みであること"
        helpText="テスト実行前に満たすべき条件を記述してください"
        initialValue={editingPrecondition?.content}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingPrecondition(null);
        }}
      />

      {/* 削除確認ダイアログ */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="前提条件を削除"
          message="この前提条件を削除しますか？この操作は取り消せません。"
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
