import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import {
  projectsApi,
  ApiError,
  type ProjectEnvironment,
  type CreateEnvironmentRequest,
  type UpdateEnvironmentRequest,
} from '../../lib/api';
import { toast } from '../../stores/toast';

interface EnvironmentFormModalProps {
  isOpen: boolean;
  projectId: string;
  /** 編集時は環境データを渡す */
  environment?: ProjectEnvironment | null;
  onClose: () => void;
  /** 作成・更新後のコールバック */
  onSaved: (environment: ProjectEnvironment) => void;
}

/**
 * 環境作成・編集モーダル
 */
export function EnvironmentFormModal({
  isOpen,
  projectId,
  environment,
  onClose,
  onSaved,
}: EnvironmentFormModalProps) {
  const isEditing = !!environment;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 編集時は既存データをセット
  useEffect(() => {
    if (isOpen && environment) {
      setName(environment.name);
      setSlug(environment.slug);
      setBaseUrl(environment.baseUrl || '');
      setDescription(environment.description || '');
      setIsDefault(environment.isDefault);
    }
  }, [isOpen, environment]);

  // モーダルを閉じる
  const handleClose = useCallback(() => {
    setName('');
    setSlug('');
    setBaseUrl('');
    setDescription('');
    setIsDefault(false);
    setErrors({});
    onClose();
  }, [onClose]);

  // ESCキーでモーダルを閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, handleClose]);

  if (!isOpen) return null;

  // slugを自動生成（名前からケバブケースに変換）
  const generateSlug = (value: string): string => {
    return value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  // 名前変更時にslugを自動生成（編集時は自動生成しない）
  const handleNameChange = (value: string) => {
    setName(value);
    setErrors((prev) => ({ ...prev, name: '' }));
    // 新規作成時のみ、かつslugがまだ手動編集されていない場合のみ自動生成
    if (!isEditing && slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '環境名は必須です';
    } else if (name.length > 50) {
      newErrors.name = '環境名は50文字以内で入力してください';
    }

    if (!slug.trim()) {
      newErrors.slug = 'スラッグは必須です';
    } else if (!/^[a-z0-9-]+$/.test(slug)) {
      newErrors.slug = 'スラッグは小文字英数字とハイフンのみ使用可能です';
    } else if (slug.length > 50) {
      newErrors.slug = 'スラッグは50文字以内で入力してください';
    }

    if (baseUrl && !/^https?:\/\/.+/.test(baseUrl)) {
      newErrors.baseUrl = '有効なURLを入力してください（http:// または https://）';
    }

    if (description.length > 200) {
      newErrors.description = '説明は200文字以内で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      let savedEnvironment: ProjectEnvironment;

      if (isEditing && environment) {
        // 更新
        const data: UpdateEnvironmentRequest = {
          name: name.trim(),
          slug: slug.trim(),
          baseUrl: baseUrl.trim() || null,
          description: description.trim() || null,
          isDefault,
        };
        const response = await projectsApi.updateEnvironment(projectId, environment.id, data);
        savedEnvironment = response.environment;
        toast.success('環境を更新しました');
      } else {
        // 作成
        const data: CreateEnvironmentRequest = {
          name: name.trim(),
          slug: slug.trim(),
          baseUrl: baseUrl.trim() || null,
          description: description.trim() || null,
          isDefault,
        };
        const response = await projectsApi.createEnvironment(projectId, data);
        savedEnvironment = response.environment;
        toast.success('環境を作成しました');
      }

      onSaved(savedEnvironment);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setErrors({ slug: 'このスラッグは既に使用されています' });
        } else if (err.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(err.details)) {
            fieldErrors[field] = messages[0];
          }
          setErrors(fieldErrors);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error(isEditing ? '環境の更新に失敗しました' : '環境の作成に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 背景クリックでモーダルを閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      handleClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {isEditing ? '環境を編集' : '環境を作成'}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 環境名 */}
          <div>
            <label htmlFor="env-name" className="block text-sm font-medium text-foreground mb-1">
              環境名 <span className="text-danger">*</span>
            </label>
            <input
              id="env-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={`input w-full ${errors.name ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="Production"
              disabled={isSubmitting}
            />
            {errors.name && <p className="text-xs text-danger mt-1">{errors.name}</p>}
          </div>

          {/* スラッグ */}
          <div>
            <label htmlFor="env-slug" className="block text-sm font-medium text-foreground mb-1">
              スラッグ <span className="text-danger">*</span>
            </label>
            <input
              id="env-slug"
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value.toLowerCase());
                setErrors((prev) => ({ ...prev, slug: '' }));
              }}
              className={`input w-full ${errors.slug ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="production"
              disabled={isSubmitting}
            />
            {errors.slug && <p className="text-xs text-danger mt-1">{errors.slug}</p>}
            <p className="text-xs text-foreground-subtle mt-1">
              小文字英数字とハイフンのみ使用可能です
            </p>
          </div>

          {/* ベースURL */}
          <div>
            <label htmlFor="env-base-url" className="block text-sm font-medium text-foreground mb-1">
              ベースURL
            </label>
            <input
              id="env-base-url"
              type="url"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setErrors((prev) => ({ ...prev, baseUrl: '' }));
              }}
              className={`input w-full ${errors.baseUrl ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="https://example.com"
              disabled={isSubmitting}
            />
            {errors.baseUrl && <p className="text-xs text-danger mt-1">{errors.baseUrl}</p>}
            <p className="text-xs text-foreground-subtle mt-1">
              テスト対象のベースURLを設定できます
            </p>
          </div>

          {/* 説明 */}
          <div>
            <label htmlFor="env-description" className="block text-sm font-medium text-foreground mb-1">
              説明
            </label>
            <textarea
              id="env-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrors((prev) => ({ ...prev, description: '' }));
              }}
              className={`input w-full resize-none ${errors.description ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="この環境の説明..."
              rows={2}
              disabled={isSubmitting}
            />
            {errors.description && <p className="text-xs text-danger mt-1">{errors.description}</p>}
          </div>

          {/* デフォルト設定 */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-border text-accent focus:ring-accent"
                disabled={isSubmitting}
              />
              <span className="text-sm text-foreground">デフォルト環境に設定</span>
            </label>
            <p className="text-xs text-foreground-subtle mt-1 ml-6">
              テスト実行時にデフォルトで選択される環境になります
            </p>
          </div>

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || !name.trim() || !slug.trim()}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? (isEditing ? '更新中...' : '作成中...') : isEditing ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
