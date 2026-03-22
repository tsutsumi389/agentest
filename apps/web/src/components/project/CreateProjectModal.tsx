import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { useOrganizationStore } from '../../stores/organization';
import { projectsApi, ApiError } from '../../lib/api';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId?: string;
}

export function CreateProjectModal({ isOpen, onClose, organizationId }: CreateProjectModalProps) {
  const queryClient = useQueryClient();
  const { organizations } = useOrganizationStore();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const organizationName = organizationId
    ? organizations.find(({ organization }) => organization.id === organizationId)?.organization
        .name
    : undefined;

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string; organizationId?: string }) =>
      projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-projects'] });
      handleClose();
    },
  });

  const handleClose = useCallback(() => {
    setName('');
    setDescription('');
    createMutation.reset();
    onCloseRef.current();
  }, [createMutation.reset]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
    }
  }, [isOpen]);

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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !createMutation.isPending) {
      handleClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      description: description || undefined,
      organizationId,
    });
  };

  const errorMessage = createMutation.isError
    ? createMutation.error instanceof ApiError
      ? createMutation.error.message
      : 'プロジェクトの作成に失敗しました'
    : null;

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
            新規プロジェクト（{organizationName ?? '個人'}）
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

        {errorMessage && (
          <div className="mb-4 p-3 bg-danger-subtle border border-danger rounded text-sm text-danger">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="block text-sm font-medium text-foreground mb-1">説明</label>
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
              disabled={!name || createMutation.isPending}
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
