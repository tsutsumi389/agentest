import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  GripVertical,
  ClipboardList,
} from 'lucide-react';
import { testSuitesApi, ApiError, type Precondition, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PreconditionFormModal } from './PreconditionFormModal';

interface PreconditionListProps {
  /** テストスイートID */
  testSuiteId: string;
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | ProjectMemberRole;
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

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // ESCキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 表示できる操作がなければ何も表示しない
  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
        disabled={isUpdating}
        aria-label="前提条件操作メニュー"
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
 * 前提条件一覧コンポーネント
 */
export function PreconditionList({ testSuiteId, currentRole }: PreconditionListProps) {
  const [preconditions, setPreconditions] = useState<Precondition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // モーダル状態
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPrecondition, setEditingPrecondition] = useState<Precondition | null>(null);

  // 確認ダイアログ状態
  const [deleteConfirm, setDeleteConfirm] = useState<{
    precondition: Precondition;
  } | null>(null);

  // ドラッグ状態
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // 権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';
  const canDelete = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  // 前提条件一覧を取得
  const fetchPreconditions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await testSuitesApi.getPreconditions(testSuiteId);
      // orderKeyでソート
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
  }, [testSuiteId]);

  useEffect(() => {
    fetchPreconditions();
  }, [fetchPreconditions]);

  // 新規作成モーダルを開く
  const handleOpenCreate = () => {
    setEditingPrecondition(null);
    setIsFormModalOpen(true);
  };

  // 編集モーダルを開く
  const handleOpenEdit = (precondition: Precondition) => {
    setEditingPrecondition(precondition);
    setIsFormModalOpen(true);
  };

  // 作成・更新後のコールバック
  const handleSaved = (savedPrecondition: Precondition) => {
    setPreconditions((prev) => {
      const existing = prev.find((p) => p.id === savedPrecondition.id);
      if (existing) {
        // 更新時
        return prev.map((p) => (p.id === savedPrecondition.id ? savedPrecondition : p));
      } else {
        // 新規作成時：orderKeyでソートして追加
        return [...prev, savedPrecondition].sort((a, b) => a.orderKey.localeCompare(b.orderKey));
      }
    });
  };

  // 削除確認
  const handleRequestDelete = (precondition: Precondition) => {
    setDeleteConfirm({ precondition });
  };

  // 削除実行
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    const precondition = deleteConfirm.precondition;
    setUpdatingId(precondition.id);

    try {
      await testSuitesApi.deletePrecondition(testSuiteId, precondition.id);
      setPreconditions((prev) => prev.filter((p) => p.id !== precondition.id));
      toast.success('前提条件を削除しました');
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

  // ドラッグ開始
  const handleDragStart = (e: React.DragEvent, preconditionId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(preconditionId);
  };

  // ドラッグオーバー
  const handleDragOver = (e: React.DragEvent, preconditionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== preconditionId) {
      setDragOverId(preconditionId);
    }
  };

  // ドラッグリーブ
  const handleDragLeave = () => {
    setDragOverId(null);
  };

  // ドロップ
  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    // 新しい順序を計算
    const oldIndex = preconditions.findIndex((p) => p.id === draggedId);
    const newIndex = preconditions.findIndex((p) => p.id === targetId);

    if (oldIndex === -1 || newIndex === -1) {
      setDraggedId(null);
      return;
    }

    // 配列を並び替え
    const newPreconditions = [...preconditions];
    const [removed] = newPreconditions.splice(oldIndex, 1);
    newPreconditions.splice(newIndex, 0, removed);

    // UIを即座に更新
    setPreconditions(newPreconditions);
    setDraggedId(null);
    setIsReordering(true);

    // APIで永続化
    try {
      const preconditionIds = newPreconditions.map((p) => p.id);
      const response = await testSuitesApi.reorderPreconditions(testSuiteId, preconditionIds);
      // サーバーから返された順序で更新
      setPreconditions(response.preconditions.sort((a, b) => a.orderKey.localeCompare(b.orderKey)));
    } catch (err) {
      // エラー時は元に戻す
      fetchPreconditions();
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('並び順の更新に失敗しました');
      }
    } finally {
      setIsReordering(false);
    }
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  if (isLoading) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">前提条件</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">前提条件</h2>
        <div className="text-center py-8">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchPreconditions}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            前提条件
            {isReordering && (
              <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
            )}
          </h2>
          <p className="text-sm text-foreground-muted mt-1">
            テスト実行前に満たすべき条件
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={handleOpenCreate} disabled={isReordering}>
            <Plus className="w-4 h-4" />
            追加
          </button>
        )}
      </div>

      {preconditions.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
          <ClipboardList className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <p className="text-foreground-muted mb-4">前提条件が設定されていません</p>
          {canEdit && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              前提条件を追加
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {preconditions.map((precondition, index) => (
            <div
              key={precondition.id}
              draggable={canEdit}
              onDragStart={(e) => handleDragStart(e, precondition.id)}
              onDragOver={(e) => handleDragOver(e, precondition.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, precondition.id)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center justify-between p-3 rounded-lg border bg-background-secondary
                transition-all
                ${draggedId === precondition.id ? 'opacity-50 border-accent' : 'border-border'}
                ${dragOverId === precondition.id ? 'border-accent border-2' : ''}
                ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}
                hover:bg-background-tertiary
              `}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* ドラッグハンドル */}
                {canEdit && (
                  <GripVertical className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                )}

                {/* インデックス番号 */}
                <span className="w-6 h-6 rounded-full bg-background-tertiary text-foreground-muted text-xs font-medium flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>

                {/* 内容 */}
                <p className="text-sm text-foreground truncate">
                  {precondition.content}
                </p>
              </div>

              {/* アクションメニュー */}
              <ActionDropdown
                canEdit={canEdit}
                canDelete={canDelete}
                onEdit={() => handleOpenEdit(precondition)}
                onDelete={() => handleRequestDelete(precondition)}
                isUpdating={updatingId === precondition.id}
              />
            </div>
          ))}
        </div>
      )}

      {/* 前提条件フォームモーダル */}
      <PreconditionFormModal
        isOpen={isFormModalOpen}
        testSuiteId={testSuiteId}
        precondition={editingPrecondition}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingPrecondition(null);
        }}
        onSaved={handleSaved}
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
