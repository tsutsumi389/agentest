import { useState, useRef, useEffect } from 'react';
import { MessageSquarePlus, X, Check, Loader2 } from 'lucide-react';

/** 最大文字数 */
const MAX_LENGTH = 2000;

interface InlineNoteEditorProps {
  /** 現在のノート内容（null = ノートなし） */
  value: string | null;
  /** ノート変更時のハンドラ */
  onChange: (note: string | null) => void;
  /** 編集可能か */
  isEditable: boolean;
  /** 更新中フラグ */
  isUpdating: boolean;
  /** プレースホルダー */
  placeholder?: string;
}

/**
 * インラインノートエディタ
 * - ノートがない場合: 「ノートを追加」リンク表示
 * - ノートがある場合: ノート内容を表示（編集可能時はクリックで編集モード）
 * - 編集モード: テキストエリア + 保存/キャンセルボタン
 */
export function InlineNoteEditor({
  value,
  onChange,
  isEditable,
  isUpdating,
  placeholder = 'ノートを入力...',
}: InlineNoteEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 編集モード開始時にテキストエリアにフォーカス
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      // カーソルを末尾に移動
      textareaRef.current.setSelectionRange(draft.length, draft.length);
    }
  }, [isEditing, draft.length]);

  // 外部からvalueが変更された場合にdraftを同期
  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? '');
    }
  }, [value, isEditing]);

  const handleStartEdit = () => {
    if (!isEditable || isUpdating) return;
    setDraft(value ?? '');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setDraft(value ?? '');
    setIsEditing(false);
  };

  const handleSave = () => {
    const trimmedDraft = draft.trim();
    // 空文字の場合はnullとして保存（ノート削除）
    onChange(trimmedDraft === '' ? null : trimmedDraft);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Escapeでキャンセル
    if (e.key === 'Escape') {
      handleCancel();
    }
    // Ctrl/Cmd + Enterで保存
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  const remainingChars = MAX_LENGTH - draft.length;
  const isOverLimit = remainingChars < 0;

  // 編集モード
  if (isEditing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`input min-h-[80px] resize-y ${isOverLimit ? 'border-danger focus:border-danger focus:ring-danger' : ''}`}
          placeholder={placeholder}
          disabled={isUpdating}
          aria-label="ノート"
          aria-describedby="note-char-count"
        />
        <div className="flex items-center justify-between">
          <span
            id="note-char-count"
            className={`text-xs ${isOverLimit ? 'text-danger' : 'text-foreground-muted'}`}
          >
            {remainingChars.toLocaleString()} 文字
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCancel}
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
              disabled={isUpdating || isOverLimit}
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

  // 表示モード - ノートがある場合
  if (value) {
    return (
      <div
        className={`
          text-sm text-foreground-muted whitespace-pre-wrap break-words
          ${isEditable && !isUpdating ? 'cursor-pointer hover:bg-background-tertiary rounded px-2 py-1 -mx-2 -my-1 transition-colors' : ''}
        `}
        onClick={handleStartEdit}
        role={isEditable ? 'button' : undefined}
        tabIndex={isEditable ? 0 : undefined}
        onKeyDown={isEditable ? (e) => e.key === 'Enter' && handleStartEdit() : undefined}
        aria-label={isEditable ? 'クリックしてノートを編集' : undefined}
      >
        {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />}
        {value}
      </div>
    );
  }

  // 表示モード - ノートがない場合
  if (!isEditable) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="flex items-center gap-1 text-sm text-foreground-muted hover:text-accent transition-colors"
      disabled={isUpdating}
    >
      {isUpdating ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <MessageSquarePlus className="w-3.5 h-3.5" />
      )}
      ノートを追加
    </button>
  );
}
