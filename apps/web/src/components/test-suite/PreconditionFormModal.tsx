import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { testSuitesApi, ApiError, type Precondition } from '../../lib/api';
import { toast } from '../../stores/toast';

interface PreconditionFormModalProps {
  isOpen: boolean;
  testSuiteId: string;
  /** 編集時は前提条件データを渡す */
  precondition?: Precondition | null;
  onClose: () => void;
  /** 作成・更新後のコールバック */
  onSaved: (precondition: Precondition) => void;
}

/**
 * 前提条件作成・編集モーダル
 */
export function PreconditionFormModal({
  isOpen,
  testSuiteId,
  precondition,
  onClose,
  onSaved,
}: PreconditionFormModalProps) {
  const isEditing = !!precondition;
  const contentInputRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 編集時は既存データをセット
  useEffect(() => {
    if (isOpen && precondition) {
      setContent(precondition.content);
    }
  }, [isOpen, precondition]);

  // モーダルオープン時にフォーカス設定
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => {
        contentInputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // モーダルを閉じる
  const handleClose = useCallback(() => {
    setContent('');
    setError(null);
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

  // バリデーション
  const validate = (): boolean => {
    if (!content.trim()) {
      setError('内容は必須です');
      return false;
    }
    if (content.length > 2000) {
      setError('内容は2000文字以内で入力してください');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let savedPrecondition: Precondition;

      if (isEditing && precondition) {
        // 更新
        const response = await testSuitesApi.updatePrecondition(
          testSuiteId,
          precondition.id,
          { content: content.trim() }
        );
        savedPrecondition = response.precondition;
        toast.success('前提条件を更新しました');
      } else {
        // 作成
        const response = await testSuitesApi.addPrecondition(testSuiteId, {
          content: content.trim(),
        });
        savedPrecondition = response.precondition;
        toast.success('前提条件を追加しました');
      }

      onSaved(savedPrecondition);
      handleClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details) {
          const fieldErrors = Object.values(err.details).flat();
          setError(fieldErrors[0] || err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError(isEditing ? '前提条件の更新に失敗しました' : '前提条件の追加に失敗しました');
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
            {isEditing ? '前提条件を編集' : '前提条件を追加'}
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
          {/* 内容 */}
          <div>
            <label htmlFor="precondition-content" className="block text-sm font-medium text-foreground mb-1">
              内容 <span className="text-danger">*</span>
            </label>
            <textarea
              ref={contentInputRef}
              id="precondition-content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setError(null);
              }}
              className={`input w-full resize-none ${error ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
              placeholder="例: ユーザーがログイン済みであること"
              rows={3}
              disabled={isSubmitting}
            />
            {error && <p className="text-xs text-danger mt-1">{error}</p>}
            <p className="text-xs text-foreground-subtle mt-1">
              テスト実行前に満たすべき条件を記述してください
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
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? (isEditing ? '更新中...' : '追加中...') : isEditing ? '更新' : '追加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
