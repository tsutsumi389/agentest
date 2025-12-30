import { useState, useRef, useEffect } from 'react';
import { X, Check, Loader2 } from 'lucide-react';

/** 最大文字数 */
const MAX_LENGTH = 2000;

interface ReviewCommentEditorProps {
  /** 現在のコンテンツ */
  initialContent: string;
  /** 保存時のハンドラ */
  onSave: (content: string) => void;
  /** キャンセル時のハンドラ */
  onCancel: () => void;
  /** 更新中フラグ */
  isUpdating: boolean;
  /** プレースホルダー */
  placeholder?: string;
}

/**
 * レビューコメント編集エディタ
 * インライン編集UI
 */
export function ReviewCommentEditor({
  initialContent,
  onSave,
  onCancel,
  isUpdating,
  placeholder = 'コメントを入力...',
}: ReviewCommentEditorProps) {
  const [content, setContent] = useState(initialContent);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // マウント時にフォーカス
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      // カーソルを末尾に移動
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    const trimmedContent = content.trim();
    if (!trimmedContent || isUpdating) return;
    onSave(trimmedContent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escapeでキャンセル
    if (e.key === 'Escape') {
      onCancel();
    }
    // Ctrl/Cmd + Enterで保存
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const remainingChars = MAX_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;
  const canSave = content.trim().length > 0 && !isOverLimit && !isUpdating;
  const hasChanges = content.trim() !== initialContent.trim();

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`
          input min-h-[80px] resize-y
          ${isOverLimit ? 'border-danger focus:border-danger focus:ring-danger' : ''}
        `}
        placeholder={placeholder}
        disabled={isUpdating}
        aria-label="コメント編集"
        aria-describedby="edit-char-count"
      />
      <div className="flex items-center justify-between">
        <span
          id="edit-char-count"
          className={`text-xs ${isOverLimit ? 'text-danger' : 'text-foreground-muted'}`}
        >
          {remainingChars.toLocaleString()} 文字
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1 px-2 py-1 text-sm text-foreground-muted hover:text-foreground transition-colors"
            disabled={isUpdating}
          >
            <X className="w-3.5 h-3.5" />
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 px-2 py-1 text-sm bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canSave || !hasChanges}
          >
            {isUpdating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
