import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Label } from '../../lib/api';
import { LabelBadge } from '../ui/LabelBadge';
import { LabelFormModal } from './LabelFormModal';

interface LabelListProps {
  /** ラベル一覧 */
  labels: Label[];
  /** ラベル作成時のコールバック */
  onCreate: (data: { name: string; description: string | null; color: string }) => Promise<void>;
  /** ラベル更新時のコールバック */
  onUpdate: (labelId: string, data: { name: string; description: string | null; color: string }) => Promise<void>;
  /** ラベル削除時のコールバック */
  onDelete: (labelId: string) => Promise<void>;
  /** ローディング中か */
  isLoading?: boolean;
  /** 編集権限があるか */
  canEdit?: boolean;
  /** 削除権限があるか */
  canDelete?: boolean;
}

/**
 * ラベル管理リストコンポーネント
 * プロジェクト設定画面で使用
 */
export function LabelList({
  labels,
  onCreate,
  onUpdate,
  onDelete,
  isLoading = false,
  canEdit = true,
  canDelete = true,
}: LabelListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [deletingLabelId, setDeletingLabelId] = useState<string | null>(null);

  // 新規作成モーダルを開く
  const handleOpenCreateModal = () => {
    setEditingLabel(null);
    setIsModalOpen(true);
  };

  // 編集モーダルを開く
  const handleOpenEditModal = (label: Label) => {
    setEditingLabel(label);
    setIsModalOpen(true);
  };

  // モーダルを閉じる
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingLabel(null);
  };

  // 保存処理
  const handleSave = async (data: { name: string; description: string | null; color: string }) => {
    if (editingLabel) {
      await onUpdate(editingLabel.id, data);
    } else {
      await onCreate(data);
    }
  };

  // 削除確認
  const handleDeleteClick = (labelId: string) => {
    setDeletingLabelId(labelId);
  };

  // 削除実行
  const handleConfirmDelete = async () => {
    if (deletingLabelId) {
      await onDelete(deletingLabelId);
      setDeletingLabelId(null);
    }
  };

  // 削除キャンセル
  const handleCancelDelete = () => {
    setDeletingLabelId(null);
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">ラベル</h3>
          <p className="text-sm text-foreground-subtle">
            テストスイートにラベルを付けて分類できます
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent-hover"
          >
            <Plus className="w-4 h-4" />
            新規ラベル
          </button>
        )}
      </div>

      {/* ラベル一覧 */}
      {isLoading ? (
        <div className="text-center py-8 text-foreground-subtle">読み込み中...</div>
      ) : labels.length === 0 ? (
        <div className="text-center py-8 text-foreground-subtle border border-dashed border-border rounded">
          ラベルがありません
        </div>
      ) : (
        <div className="border border-border rounded divide-y divide-border">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center gap-4 p-3 hover:bg-background-secondary"
            >
              {/* ラベルバッジ */}
              <LabelBadge label={label} />

              {/* 説明 */}
              <span className="flex-1 text-sm text-foreground-subtle truncate">
                {label.description || '説明なし'}
              </span>

              {/* アクションボタン */}
              <div className="flex items-center gap-1">
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(label)}
                    className="p-1.5 hover:bg-background-tertiary rounded"
                    aria-label="編集"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(label.id)}
                    className="p-1.5 hover:bg-danger-subtle hover:text-danger rounded"
                    aria-label="削除"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 削除確認ダイアログ */}
      {deletingLabelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-border rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-2">ラベルを削除</h3>
            <p className="text-sm text-foreground-subtle mb-4">
              このラベルを削除すると、すべてのテストスイートからこのラベルが削除されます。
              この操作は取り消せません。
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm border border-border rounded hover:bg-background-secondary"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-sm bg-danger text-white rounded hover:bg-danger-hover"
              >
                削除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 作成/編集モーダル */}
      <LabelFormModal
        isOpen={isModalOpen}
        label={editingLabel}
        onClose={handleCloseModal}
        onSave={handleSave}
      />
    </div>
  );
}
