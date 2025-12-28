import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, User, Building2, Loader2 } from 'lucide-react';
import { useOrganizationStore } from '../../stores/organization';
import { projectsApi, ApiError } from '../../lib/api';

/** プロジェクトの所有者タイプ */
type OwnerType = 'personal' | 'organization';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * プロジェクト作成モーダル
 */
export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const queryClient = useQueryClient();
  const { organizations } = useOrganizationStore();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerType, setOwnerType] = useState<OwnerType>('personal');
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>('');

  const hasOrganizations = organizations.length > 0;

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; organizationId?: string }) =>
      projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-projects'] });
      handleClose();
    },
  });

  // フォームをリセットしてモーダルを閉じる
  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    setOwnerType('personal');
    setSelectedOrganizationId('');
    createMutation.reset();
    onClose();
  }, [onClose, createMutation]);

  // モーダルオープン時にフォーカス設定
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createMutation.isPending) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, createMutation.isPending, handleClose]);

  if (!isOpen) return null;

  // 背景クリックでモーダルを閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !createMutation.isPending) {
      handleClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const organizationId = ownerType === 'organization' ? selectedOrganizationId : undefined;
    createMutation.mutate({
      name,
      description: description || undefined,
      organizationId,
    });
  };

  // エラーメッセージを取得
  const getErrorMessage = () => {
    if (!createMutation.isError) return null;
    if (createMutation.error instanceof ApiError) {
      return createMutation.error.message;
    }
    return 'プロジェクトの作成に失敗しました';
  };

  const errorMessage = getErrorMessage();

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-modal-title"
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 id="create-project-modal-title" className="text-lg font-semibold text-foreground">
            新規プロジェクト
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
            disabled={createMutation.isPending}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* エラーメッセージ */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-danger-subtle border border-danger rounded text-sm text-danger">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 所有者選択 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              所有者 <span className="text-danger">*</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOwnerType('personal')}
                className={`flex-1 p-3 rounded border flex items-center justify-center gap-2 transition-colors ${
                  ownerType === 'personal'
                    ? 'border-accent bg-accent-subtle text-accent'
                    : 'border-border-default text-foreground-muted hover:border-foreground-subtle'
                }`}
                disabled={createMutation.isPending}
              >
                <User className="w-4 h-4" />
                <span>個人</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOwnerType('organization');
                  // 組織が選択されていなければ最初の組織を選択
                  if (!selectedOrganizationId && hasOrganizations) {
                    setSelectedOrganizationId(organizations[0].organization.id);
                  }
                }}
                disabled={!hasOrganizations || createMutation.isPending}
                className={`flex-1 p-3 rounded border flex items-center justify-center gap-2 transition-colors ${
                  ownerType === 'organization'
                    ? 'border-accent bg-accent-subtle text-accent'
                    : 'border-border-default text-foreground-muted hover:border-foreground-subtle'
                } ${!hasOrganizations ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Building2 className="w-4 h-4" />
                <span>組織</span>
              </button>
            </div>
            {!hasOrganizations && (
              <p className="text-xs text-foreground-subtle mt-1">
                組織に所属していません
              </p>
            )}
          </div>

          {/* 組織選択ドロップダウン */}
          {ownerType === 'organization' && hasOrganizations && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                組織を選択 <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
                <select
                  value={selectedOrganizationId}
                  onChange={(e) => setSelectedOrganizationId(e.target.value)}
                  className="input pl-10 pr-8 appearance-none"
                  required
                  disabled={createMutation.isPending}
                >
                  <option value="" disabled>
                    組織を選択してください
                  </option>
                  {organizations.map(({ organization, role }) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name} ({role === 'OWNER' ? 'オーナー' : role === 'ADMIN' ? '管理者' : 'メンバー'})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              プロジェクト名 <span className="text-danger">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="例: Webアプリテスト"
              required
              disabled={createMutation.isPending}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input min-h-[80px]"
              placeholder="プロジェクトの説明を入力..."
              disabled={createMutation.isPending}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={createMutation.isPending}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={
                !name ||
                (ownerType === 'organization' && !selectedOrganizationId) ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  作成中...
                </>
              ) : (
                '作成'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
