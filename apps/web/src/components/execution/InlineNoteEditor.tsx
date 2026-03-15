import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquarePlus, X, Check, Loader2 } from 'lucide-react';
import { MarkdownToolbar, MarkdownPreview } from '../common/markdown';

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
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // 外部からvalueが変更された場合にdraftを同期
  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? '');
    }
  }, [value, isEditing]);

  // テキストエリアに書式を挿入する
  const handleInsert = useCallback((prefix: string, suffix: string, block?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const currentValue = textarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentValue.substring(start, end);

    let newText: string;
    let newCursorPos: number;

    if (block) {
      // 行頭に挿入するタイプ（リスト、引用、見出しなど）
      const lineStart = currentValue.lastIndexOf('\n', start - 1) + 1;
      const beforeLine = currentValue.substring(0, lineStart);
      const afterLineStart = currentValue.substring(lineStart);

      newText = beforeLine + prefix + afterLineStart;
      newCursorPos = lineStart + prefix.length + (start - lineStart);
    } else if (selectedText) {
      // テキストが選択されている場合：選択範囲を囲む
      newText =
        currentValue.substring(0, start) +
        prefix +
        selectedText +
        suffix +
        currentValue.substring(end);
      newCursorPos = start + prefix.length + selectedText.length + suffix.length;
    } else {
      // 選択されていない場合：カーソル位置に挿入
      newText = currentValue.substring(0, start) + prefix + suffix + currentValue.substring(end);
      newCursorPos = start + prefix.length;
    }

    setDraft(newText);

    // カーソル位置を更新（非同期で行う必要がある）
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  }, []);

  const handleStartEdit = () => {
    if (!isEditable || isUpdating) return;
    setDraft(value ?? '');
    setIsEditing(true);
  };

  const handleCancel = useCallback(() => {
    setDraft(value ?? '');
    setIsEditing(false);
  }, [value]);

  const handleSave = useCallback(() => {
    const trimmedDraft = draft.trim();
    // 空文字の場合はnullとして保存（ノート削除）
    onChange(trimmedDraft === '' ? null : trimmedDraft);
    setIsEditing(false);
  }, [draft, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Escapeでキャンセル
      if (e.key === 'Escape') {
        handleCancel();
        return;
      }

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      switch (e.key.toLowerCase()) {
        case 'b': // 太字: Ctrl/Cmd+B
          e.preventDefault();
          handleInsert('**', '**');
          break;
        case 'i': // 斜体: Ctrl/Cmd+I
          e.preventDefault();
          handleInsert('*', '*');
          break;
        case 'k': // リンク: Ctrl/Cmd+K
          e.preventDefault();
          handleInsert('[', '](url)');
          break;
        case 'enter': // 保存: Ctrl/Cmd+Enter
          e.preventDefault();
          handleSave();
          break;
      }
    },
    [handleCancel, handleInsert, handleSave]
  );

  const remainingChars = MAX_LENGTH - draft.length;
  const isOverLimit = remainingChars < 0;

  // 編集モード
  if (isEditing) {
    return (
      <div className="space-y-2">
        <div
          className={`border rounded-lg overflow-hidden ${isOverLimit ? 'border-danger' : 'border-border'}`}
        >
          <MarkdownToolbar textareaRef={textareaRef} onInsert={handleInsert} />
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full px-3 py-2 min-h-[80px] resize-y border-none bg-background-secondary text-sm focus:outline-none focus:ring-0 ${isOverLimit ? 'text-danger' : ''}`}
            placeholder={placeholder}
            disabled={isUpdating}
            aria-label="ノート"
            aria-describedby="note-char-count"
          />
        </div>
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
          text-sm text-foreground-muted
          ${isEditable && !isUpdating ? 'cursor-pointer hover:bg-background-tertiary rounded px-2 py-1 -mx-2 -my-1 transition-colors' : ''}
        `}
        onClick={handleStartEdit}
        role={isEditable ? 'button' : undefined}
        tabIndex={isEditable ? 0 : undefined}
        onKeyDown={isEditable ? (e) => e.key === 'Enter' && handleStartEdit() : undefined}
        aria-label={isEditable ? 'クリックしてノートを編集' : undefined}
      >
        {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />}
        <MarkdownPreview content={value} />
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
