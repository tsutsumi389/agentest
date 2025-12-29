import { useState, useEffect, useRef } from 'react';
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
  MoreVertical,
  Pencil,
  Trash2,
  GripVertical,
  ListOrdered,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCaseStep, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TestCaseItemFormModal } from './TestCaseItemFormModal';

interface TestCaseStepListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialSteps?: TestCaseStep[];
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | ProjectMemberRole;
  /** 更新時のコールバック */
  onUpdated?: () => void;
}

/**
 * アクションドロップダウン
 */
function ActionDropdown({
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  isUpdating,
}: {
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isUpdating: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
        disabled={isUpdating}
        aria-label="ステップ操作メニュー"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <MoreVertical className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-32 bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="menu"
        >
          {canEdit && (
            <button
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              role="menuitem"
            >
              <Pencil className="w-4 h-4" />
              編集
            </button>
          )}

          {canDelete && (
            <>
              {canEdit && <div className="border-t border-border my-1" />}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger-subtle transition-colors"
                onClick={() => {
                  onDelete();
                  setIsOpen(false);
                }}
                role="menuitem"
              >
                <Trash2 className="w-4 h-4" />
                削除
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ソート可能なステップアイテム
 */
function SortableStepItem({
  step,
  index,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  isUpdating,
  isReordering,
}: {
  step: TestCaseStep;
  index: number;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isUpdating: boolean;
  isReordering: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id, disabled: !canEdit || isReordering });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center justify-between p-3 rounded-lg border bg-background-secondary
        transition-colors
        ${isDragging ? 'opacity-50 border-accent shadow-lg z-10' : 'border-border'}
        hover:bg-background-tertiary
      `}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none p-1 -m-1 text-foreground-muted hover:text-foreground"
            aria-label="ドラッグして並び替え"
          >
            <GripVertical className="w-4 h-4 flex-shrink-0" />
          </button>
        )}

        <span className="w-6 h-6 rounded-full bg-accent text-white text-xs font-medium flex items-center justify-center flex-shrink-0">
          {index + 1}
        </span>

        <p className="text-sm text-foreground truncate">
          {step.content}
        </p>
      </div>

      <ActionDropdown
        canEdit={canEdit}
        canDelete={canDelete}
        onEdit={onEdit}
        onDelete={onDelete}
        isUpdating={isUpdating}
      />
    </div>
  );
}

/**
 * テストケースステップ一覧コンポーネント
 */
export function TestCaseStepList({
  testCaseId,
  initialSteps,
  currentRole,
  onUpdated,
}: TestCaseStepListProps) {
  const [steps, setSteps] = useState<TestCaseStep[]>(initialSteps || []);
  const [isLoading, setIsLoading] = useState(!initialSteps);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<TestCaseStep | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    step: TestCaseStep;
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
    if (initialSteps) {
      setSteps(initialSteps);
      return;
    }

    const fetchSteps = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await testCasesApi.getSteps(testCaseId);
        const sorted = response.steps.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        setSteps(sorted);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('ステップ一覧の取得に失敗しました');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSteps();
  }, [testCaseId, initialSteps]);

  const handleOpenCreate = () => {
    setEditingStep(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (step: TestCaseStep) => {
    setEditingStep(step);
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (content: string) => {
    setIsSubmitting(true);

    try {
      if (editingStep) {
        const response = await testCasesApi.updateStep(testCaseId, editingStep.id, { content });
        setSteps((prev) =>
          prev.map((s) => (s.id === editingStep.id ? response.step : s))
        );
        toast.success('ステップを更新しました');
      } else {
        const response = await testCasesApi.addStep(testCaseId, { content });
        setSteps((prev) =>
          [...prev, response.step].sort((a, b) => a.orderKey.localeCompare(b.orderKey))
        );
        toast.success('ステップを追加しました');
      }
      onUpdated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        throw new Error(err.message);
      }
      throw new Error(editingStep ? 'ステップの更新に失敗しました' : 'ステップの追加に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDelete = (step: TestCaseStep) => {
    setDeleteConfirm({ step });
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    const step = deleteConfirm.step;
    setUpdatingId(step.id);

    try {
      await testCasesApi.deleteStep(testCaseId, step.id);
      setSteps((prev) => prev.filter((s) => s.id !== step.id));
      toast.success('ステップを削除しました');
      onUpdated?.();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('ステップの削除に失敗しました');
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

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newSteps = arrayMove(steps, oldIndex, newIndex);
    setSteps(newSteps);
    setIsReordering(true);

    try {
      const stepIds = newSteps.map((s) => s.id);
      const response = await testCasesApi.reorderSteps(testCaseId, stepIds);
      setSteps(response.steps.sort((a, b) => a.orderKey.localeCompare(b.orderKey)));
      onUpdated?.();
    } catch (err) {
      try {
        const response = await testCasesApi.getSteps(testCaseId);
        setSteps(response.steps.sort((a, b) => a.orderKey.localeCompare(b.orderKey)));
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
          <h3 className="text-sm font-semibold text-foreground">テスト手順</h3>
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
          <h3 className="text-sm font-semibold text-foreground">テスト手順</h3>
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
          <h3 className="text-sm font-semibold text-foreground">テスト手順</h3>
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

      {steps.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
          <ListOrdered className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
          <p className="text-foreground-muted text-sm mb-3">テスト手順が設定されていません</p>
          {canEdit && (
            <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
              <Plus className="w-3 h-3" />
              手順を追加
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
            items={steps.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {steps.map((step, index) => (
                <SortableStepItem
                  key={step.id}
                  step={step}
                  index={index}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onEdit={() => handleOpenEdit(step)}
                  onDelete={() => handleRequestDelete(step)}
                  isUpdating={updatingId === step.id}
                  isReordering={isReordering}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <TestCaseItemFormModal
        isOpen={isFormModalOpen}
        title={editingStep ? 'ステップを編集' : 'ステップを追加'}
        placeholder="例: ログインボタンをクリックする"
        helpText="テストで実行する操作を記述してください"
        initialValue={editingStep?.content}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingStep(null);
        }}
      />

      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="ステップを削除"
          message="このステップを削除しますか？この操作は取り消せません。"
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
