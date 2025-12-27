import { useState, useEffect, useRef } from 'react';
import { X, Building2, Loader2 } from 'lucide-react';
import { organizationsApi, ApiError } from '../../lib/api';
import { useOrganization } from '../../contexts/OrganizationContext';

interface CreateOrganizationModalProps {
  /** モーダルが開いているかどうか */
  isOpen: boolean;
  /** モーダルを閉じる */
  onClose: () => void;
  /** 作成成功時のコールバック */
  onSuccess?: (organizationId: string) => void;
}

/**
 * 組織名からスラッグを生成する
 * - 小文字に変換
 * - 英数字とハイフンのみ許可
 * - 連続するハイフンを単一に
 * - 先頭・末尾のハイフンを削除
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * 組織作成モーダル
 */
export function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateOrganizationModalProps) {
  const { refreshOrganizations } = useOrganization();
  const nameInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  // UI状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // モーダルが開いたらフォームをリセットしてフォーカス
  useEffect(() => {
    if (isOpen) {
      setName('');
      setSlug('');
      setDescription('');
      setIsSlugManuallyEdited(false);
      setErrors({});
      // 少し遅延させてDOMが準備されてからフォーカス
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // 組織名が変更されたらスラッグを自動生成
  useEffect(() => {
    if (!isSlugManuallyEdited) {
      setSlug(generateSlug(name));
    }
  }, [name, isSlugManuallyEdited]);

  // スラッグ入力時に手動編集フラグを立てる
  const handleSlugChange = (value: string) => {
    // スラッグとして有効な文字のみ許可
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(sanitized);
    setIsSlugManuallyEdited(true);
  };

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '組織名は必須です';
    } else if (name.length > 100) {
      newErrors.name = '組織名は100文字以内で入力してください';
    }

    if (!slug.trim()) {
      newErrors.slug = 'スラッグは必須です';
    } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(slug)) {
      newErrors.slug = 'スラッグは英小文字、数字、ハイフンのみ使用できます（先頭と末尾はハイフン不可）';
    } else if (slug.length < 2) {
      newErrors.slug = 'スラッグは2文字以上必要です';
    } else if (slug.length > 50) {
      newErrors.slug = 'スラッグは50文字以内で入力してください';
    }

    if (description.length > 500) {
      newErrors.description = '説明は500文字以内で入力してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 送信
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await organizationsApi.create({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
      });

      // 組織一覧を再取得
      await refreshOrganizations();

      // 成功コールバック
      onSuccess?.(response.organization.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          // フィールド別のエラー
          const fieldErrors: Record<string, string> = {};
          for (const [field, messages] of Object.entries(err.details)) {
            fieldErrors[field] = messages[0];
          }
          setErrors(fieldErrors);
        } else if (err.code === 'CONFLICT' || err.message.includes('既に使用されています')) {
          setErrors({ slug: 'このスラッグは既に使用されています' });
        } else {
          setErrors({ general: err.message });
        }
      } else {
        setErrors({ general: '組織の作成に失敗しました' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ESCキーでモーダルを閉じる
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-org-title"
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* モーダル */}
      <div
        className="relative w-full max-w-md bg-background-secondary border border-border rounded-xl shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background-tertiary">
              <Building2 className="w-5 h-5 text-foreground-muted" aria-hidden="true" />
            </div>
            <h2 id="create-org-title" className="text-lg font-semibold text-foreground">
              組織を作成
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded-md transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* 全般エラー */}
            {errors.general && (
              <div className="p-3 text-sm text-error bg-error/10 border border-error/20 rounded-lg">
                {errors.general}
              </div>
            )}

            {/* 組織名 */}
            <div>
              <label htmlFor="org-name" className="block text-sm font-medium text-foreground mb-1.5">
                組織名 <span className="text-error">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="org-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Organization"
                className={`input w-full ${errors.name ? 'border-error focus:border-error' : ''}`}
                disabled={isSubmitting}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'org-name-error' : undefined}
              />
              {errors.name && (
                <p id="org-name-error" className="mt-1 text-sm text-error">
                  {errors.name}
                </p>
              )}
            </div>

            {/* スラッグ */}
            <div>
              <label htmlFor="org-slug" className="block text-sm font-medium text-foreground mb-1.5">
                スラッグ <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">
                  /
                </span>
                <input
                  id="org-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="my-organization"
                  className={`input w-full pl-6 font-mono text-sm ${errors.slug ? 'border-error focus:border-error' : ''}`}
                  disabled={isSubmitting}
                  aria-invalid={!!errors.slug}
                  aria-describedby="org-slug-hint org-slug-error"
                />
              </div>
              <p id="org-slug-hint" className="mt-1 text-xs text-foreground-muted">
                URLに使用されます。英小文字、数字、ハイフンのみ使用可能
              </p>
              {errors.slug && (
                <p id="org-slug-error" className="mt-1 text-sm text-error">
                  {errors.slug}
                </p>
              )}
            </div>

            {/* 説明 */}
            <div>
              <label htmlFor="org-description" className="block text-sm font-medium text-foreground mb-1.5">
                説明
              </label>
              <textarea
                id="org-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="組織の説明（任意）"
                rows={3}
                className={`input w-full resize-none ${errors.description ? 'border-error focus:border-error' : ''}`}
                disabled={isSubmitting}
                aria-invalid={!!errors.description}
                aria-describedby={errors.description ? 'org-description-error' : undefined}
              />
              {errors.description && (
                <p id="org-description-error" className="mt-1 text-sm text-error">
                  {errors.description}
                </p>
              )}
            </div>
          </div>

          {/* フッター */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
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
