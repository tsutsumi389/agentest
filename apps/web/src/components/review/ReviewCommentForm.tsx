import { useState, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { MarkdownEditor } from '../common/markdown';

/** 最大文字数 */
const MAX_LENGTH = 2000;

interface ReviewCommentFormProps {
  /** 送信時のハンドラ */
  onSubmit: (content: string) => void;
  /** 送信中フラグ */
  isSubmitting: boolean;
  /** プレースホルダー */
  placeholder?: string;
  /** 自動フォーカス */
  autoFocus?: boolean;
  /** キャンセル時のハンドラ（任意、返信フォームでの使用） */
  onCancel?: () => void;
  /** コンパクトモード（返信フォーム用） */
  compact?: boolean;
}

/**
 * レビューコメント入力フォーム
 * コメント/返信の作成に使用
 */
export function ReviewCommentForm({
  onSubmit,
  isSubmitting,
  placeholder = 'コメントを入力...',
  autoFocus = false,
  onCancel,
  compact = false,
}: ReviewCommentFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmedContent = content.trim();
    if (!trimmedContent || isSubmitting) return;
    onSubmit(trimmedContent);
    setContent('');
  }, [content, isSubmitting, onSubmit]);

  // Ctrl/Cmd + Enterで送信
  const handleMarkdownSubmit = useCallback(() => {
    handleSubmit();
  }, [handleSubmit]);

  const remainingChars = MAX_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;
  const canSubmit = content.trim().length > 0 && !isOverLimit && !isSubmitting;

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <MarkdownEditor
        value={content}
        onChange={setContent}
        placeholder={placeholder}
        rows={compact ? 3 : 4}
        error={isOverLimit}
        disabled={isSubmitting}
        autoFocus={autoFocus}
        onSubmit={handleMarkdownSubmit}
      />
      <div className="flex items-center justify-between">
        <span
          id="comment-char-count"
          className={`text-xs ${isOverLimit ? 'text-danger' : 'text-foreground-muted'}`}
        >
          {remainingChars.toLocaleString()} 文字
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-foreground-muted hover:text-foreground transition-colors"
              disabled={isSubmitting}
            >
              キャンセル
            </button>
          )}
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            送信
          </button>
        </div>
      </div>
    </form>
  );
}
