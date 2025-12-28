import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Star,
  GripVertical,
  ExternalLink,
  Server,
} from 'lucide-react';
import { projectsApi, ApiError, type ProjectEnvironment, type Project, type ProjectMemberRole } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { EnvironmentFormModal } from './EnvironmentFormModal';

interface EnvironmentListProps {
  /** プロジェクト */
  project: Project;
  /** 現在のユーザーのロール（オーナーの場合は 'OWNER'） */
  currentRole?: 'OWNER' | ProjectMemberRole;
}

/**
 * アクションドロップダウン
 */
function ActionDropdown({
  environment,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onSetDefault,
  isUpdating,
}: {
  environment: ProjectEnvironment;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
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
        aria-label="環境操作メニュー"
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
          className="absolute right-0 top-full mt-1 w-48 bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="menu"
        >
          {canEdit && (
            <>
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

              {!environment.isDefault && (
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-background-tertiary transition-colors"
                  onClick={() => {
                    onSetDefault();
                    setIsOpen(false);
                  }}
                  role="menuitem"
                >
                  <Star className="w-4 h-4" />
                  デフォルトに設定
                </button>
              )}
            </>
          )}

          {canDelete && (
            <>
              <div className="border-t border-border my-1" />
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
 * 環境一覧コンポーネント
 */
export function EnvironmentList({ project, currentRole }: EnvironmentListProps) {
  const [environments, setEnvironments] = useState<ProjectEnvironment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // モーダル状態
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingEnvironment, setEditingEnvironment] = useState<ProjectEnvironment | null>(null);

  // 確認ダイアログ状態
  const [deleteConfirm, setDeleteConfirm] = useState<{
    environment: ProjectEnvironment;
  } | null>(null);

  // ドラッグ状態
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // 権限チェック
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';
  const canDelete = currentRole === 'OWNER' || currentRole === 'ADMIN';

  // 環境一覧を取得
  const fetchEnvironments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await projectsApi.getEnvironments(project.id);
      // sortOrderでソート
      const sorted = response.environments.sort((a, b) => a.sortOrder - b.sortOrder);
      setEnvironments(sorted);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('環境一覧の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  // 新規作成モーダルを開く
  const handleOpenCreate = () => {
    setEditingEnvironment(null);
    setIsFormModalOpen(true);
  };

  // 編集モーダルを開く
  const handleOpenEdit = (env: ProjectEnvironment) => {
    setEditingEnvironment(env);
    setIsFormModalOpen(true);
  };

  // 作成・更新後のコールバック
  const handleSaved = (savedEnv: ProjectEnvironment) => {
    setEnvironments((prev) => {
      const existing = prev.find((e) => e.id === savedEnv.id);
      if (existing) {
        // 更新時：isDefaultが変更された場合、他の環境のisDefaultをfalseにする
        return prev.map((e) => {
          if (e.id === savedEnv.id) {
            return savedEnv;
          }
          if (savedEnv.isDefault && e.isDefault) {
            return { ...e, isDefault: false };
          }
          return e;
        });
      } else {
        // 新規作成時：isDefaultがtrueの場合、他の環境のisDefaultをfalseにする
        const updated = savedEnv.isDefault
          ? prev.map((e) => ({ ...e, isDefault: false }))
          : prev;
        return [...updated, savedEnv].sort((a, b) => a.sortOrder - b.sortOrder);
      }
    });
  };

  // デフォルトに設定
  const handleSetDefault = async (env: ProjectEnvironment) => {
    if (env.isDefault) return;

    setUpdatingId(env.id);

    try {
      const response = await projectsApi.updateEnvironment(project.id, env.id, { isDefault: true });
      // 他の環境のisDefaultをfalseにし、対象環境を更新
      setEnvironments((prev) =>
        prev.map((e) =>
          e.id === env.id ? response.environment : { ...e, isDefault: false }
        )
      );
      toast.success(`${env.name} をデフォルトに設定しました`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('デフォルト設定に失敗しました');
      }
    } finally {
      setUpdatingId(null);
    }
  };

  // 削除確認
  const handleRequestDelete = (env: ProjectEnvironment) => {
    setDeleteConfirm({ environment: env });
  };

  // 削除実行
  const handleDelete = async () => {
    if (!deleteConfirm) return;

    const env = deleteConfirm.environment;
    setUpdatingId(env.id);

    try {
      await projectsApi.deleteEnvironment(project.id, env.id);
      setEnvironments((prev) => prev.filter((e) => e.id !== env.id));
      toast.success(`${env.name} を削除しました`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('環境の削除に失敗しました');
      }
    } finally {
      setUpdatingId(null);
      setDeleteConfirm(null);
    }
  };

  // ドラッグ開始
  const handleDragStart = (e: React.DragEvent, envId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(envId);
  };

  // ドラッグオーバー
  const handleDragOver = (e: React.DragEvent, envId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedId && draggedId !== envId) {
      setDragOverId(envId);
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
    const oldIndex = environments.findIndex((e) => e.id === draggedId);
    const newIndex = environments.findIndex((e) => e.id === targetId);

    if (oldIndex === -1 || newIndex === -1) {
      setDraggedId(null);
      return;
    }

    // 配列を並び替え
    const newEnvs = [...environments];
    const [removed] = newEnvs.splice(oldIndex, 1);
    newEnvs.splice(newIndex, 0, removed);

    // UIを即座に更新
    setEnvironments(newEnvs);
    setDraggedId(null);
    setIsReordering(true);

    // APIで永続化
    try {
      const environmentIds = newEnvs.map((e) => e.id);
      await projectsApi.reorderEnvironments(project.id, environmentIds);
    } catch (err) {
      // エラー時は元に戻す
      fetchEnvironments();
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
        <h2 className="text-lg font-semibold text-foreground mb-4">環境設定</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">環境設定</h2>
        <div className="text-center py-8">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchEnvironments}>
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
            環境設定
            {isReordering && (
              <Loader2 className="w-4 h-4 animate-spin text-foreground-muted" />
            )}
          </h2>
          <p className="text-sm text-foreground-muted mt-1">
            テスト実行環境を管理します
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={handleOpenCreate} disabled={isReordering}>
            <Plus className="w-4 h-4" />
            環境を追加
          </button>
        )}
      </div>

      {environments.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
          <Server className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <p className="text-foreground-muted mb-4">環境が設定されていません</p>
          {canEdit && (
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <Plus className="w-4 h-4" />
              最初の環境を作成
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {environments.map((env) => (
            <div
              key={env.id}
              draggable={canEdit}
              onDragStart={(e) => handleDragStart(e, env.id)}
              onDragOver={(e) => handleDragOver(e, env.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, env.id)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center justify-between p-3 rounded-lg border bg-background-secondary
                transition-all
                ${draggedId === env.id ? 'opacity-50 border-accent' : 'border-border'}
                ${dragOverId === env.id ? 'border-accent border-2' : ''}
                ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}
                hover:bg-background-tertiary
              `}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* ドラッグハンドル */}
                {canEdit && (
                  <GripVertical className="w-4 h-4 text-foreground-muted flex-shrink-0" />
                )}

                {/* 環境情報 */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground truncate">
                      {env.name}
                    </span>
                    <span className="text-xs text-foreground-subtle bg-background-tertiary px-1.5 py-0.5 rounded font-mono">
                      {env.slug}
                    </span>
                    {env.isDefault && (
                      <span className="badge badge-accent text-xs flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        デフォルト
                      </span>
                    )}
                  </div>
                  {env.description && (
                    <p className="text-sm text-foreground-muted truncate mt-0.5">
                      {env.description}
                    </p>
                  )}
                  {env.baseUrl && (
                    <div className="flex items-center gap-1 mt-1">
                      <ExternalLink className="w-3 h-3 text-foreground-subtle" />
                      <a
                        href={env.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {env.baseUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* アクションメニュー */}
              <ActionDropdown
                environment={env}
                canEdit={canEdit}
                canDelete={canDelete && !env.isDefault}
                onEdit={() => handleOpenEdit(env)}
                onDelete={() => handleRequestDelete(env)}
                onSetDefault={() => handleSetDefault(env)}
                isUpdating={updatingId === env.id}
              />
            </div>
          ))}
        </div>
      )}

      {/* 環境フォームモーダル */}
      <EnvironmentFormModal
        isOpen={isFormModalOpen}
        projectId={project.id}
        environment={editingEnvironment}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingEnvironment(null);
        }}
        onSaved={handleSaved}
      />

      {/* 削除確認ダイアログ */}
      {deleteConfirm && (
        <ConfirmDialog
          isOpen={true}
          title="環境を削除"
          message={`${deleteConfirm.environment.name} を削除しますか？この操作は取り消せません。`}
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
