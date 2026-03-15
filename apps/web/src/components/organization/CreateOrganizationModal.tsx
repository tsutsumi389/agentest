import { useState, useEffect, useRef, useCallback } from 'react';
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
 * 組織作成モーダル
 */
export function CreateOrganizationModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateOrganizationModalProps) {
  const { refreshOrganizations } = useOrganization();
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // フォーム状態
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // UI状態
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // フォームをリセットする
  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setErrors({});
  }, []);

  // モーダルが開いたらフォームをリセットしてフォーカス、背景スクロールを無効化
  useEffect(() => {
    if (isOpen) {
      resetForm();
      // 背景スクロールを無効化
      document.body.style.overflow = 'hidden';
      // DOMが準備されてからフォーカス
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
      });
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, resetForm]);

  // フォーカストラップ: モーダル内でTabキーをトラップする
  const handleTabKey = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || !modalRef.current) return;

      // フォーカス可能な要素を網羅的に取得
      const focusableSelector = [
        'button:not([disabled])',
        'input:not([disabled])',
        'textarea:not([disabled])',
        'select:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');
      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(focusableSelector);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift+Tab: 最初の要素から最後へ
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          // Tab: 最後の要素から最初へ
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    },
    [isOpen]
  );

  // ESCキーでモーダルを閉じる
  const handleEscapeKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // キーボードイベントリスナー（フォーカストラップ + ESCキー）
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleTabKey);
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleTabKey);
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, handleTabKey, handleEscapeKey]);

  // バリデーション
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = '組織名は必須です';
    } else if (name.length > 100) {
      newErrors.name = '組織名は100文字以内で入力してください';
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
        description: description.trim() || undefined,
      });

      // 組織一覧を再取得
      await refreshOrganizations();

      // フォームをリセットしてからモーダルを閉じる
      resetForm();
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

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-org-title"
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* モーダル */}
      <div
        ref={modalRef}
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
              <label
                htmlFor="org-name"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
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

            {/* 説明 */}
            <div>
              <label
                htmlFor="org-description"
                className="block text-sm font-medium text-foreground mb-1.5"
              >
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
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
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
