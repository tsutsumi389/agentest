import { useState, useEffect, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { MarkdownEditor } from '../common/markdown';

interface TestCaseItemFormModalProps {
  isOpen: boolean;
  /** モーダルタイトル（例: "前提条件を追加"） */
  title: string;
  /** プレースホルダー（例: "例: ユーザーがログイン済みであること"） */
  placeholder: string;
  /** ヘルプテキスト（例: "テスト実行前に満たすべき条件を記述してください"） */
  helpText?: string;
  /** 編集時の初期値 */
  initialValue?: string;
  /** 送信中フラグ */
  isSubmitting?: boolean;
  /** 送信ハンドラ */
  onSubmit: (content: string) => Promise<void>;
  /** 閉じるハンドラ */
  onClose: () => void;
}

/**
 * テストケースアイテム（前提条件・ステップ・期待結果）用汎用フォームモーダル
 */
export function TestCaseItemFormModal({
  isOpen,
  title,
  placeholder,
  helpText,
  initialValue,
  isSubmitting = false,
  onSubmit,
  onClose,
}: TestCaseItemFormModalProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);

  // モーダルオープン時に初期値をセット
  useEffect(() => {
    if (isOpen) {
      setContent(initialValue ?? '');
      setError(null);
    }
  }, [isOpen, initialValue]);

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

    setError(null);

    try {
      await onSubmit(content.trim());
      handleClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('保存に失敗しました');
      }
    }
  };

  // 背景クリックでモーダルを閉じる
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      handleClose();
    }
  };

  const isEditing = !!initialValue;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {title}
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
            <label htmlFor="item-content" className="block text-sm font-medium text-foreground mb-1">
              内容 <span className="text-danger">*</span>
            </label>
            <MarkdownEditor
              value={content}
              onChange={(value) => {
                setContent(value);
                setError(null);
              }}
              placeholder={placeholder}
              rows={4}
              className={error ? 'border-danger' : ''}
            />
            {error && <p className="text-xs text-danger mt-1">{error}</p>}
            {helpText && (
              <p className="text-xs text-foreground-subtle mt-1">
                {helpText}（Markdown対応）
              </p>
            )}
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
