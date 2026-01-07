import { useState, useRef, useCallback } from 'react';
import { MarkdownToolbar } from './MarkdownToolbar';
import { MarkdownPreview } from './MarkdownPreview';

type TabMode = 'write' | 'preview';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

/**
 * Markdownエディタコンポーネント
 * Write/Previewタブ切り替え、ツールバー付きのエディタ
 */
export function MarkdownEditor({
  value,
  onChange,
  placeholder = '',
  rows = 4,
  className = '',
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<TabMode>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // テキストエリアに書式を挿入する
  const handleInsert = useCallback(
    (prefix: string, suffix: string, block?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);

      let newText: string;
      let newCursorPos: number;

      if (block) {
        // 行頭に挿入するタイプ（リスト、引用、見出しなど）
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const beforeLine = value.substring(0, lineStart);
        const afterLineStart = value.substring(lineStart);

        newText = beforeLine + prefix + afterLineStart;
        newCursorPos = lineStart + prefix.length + (start - lineStart);
      } else if (selectedText) {
        // テキストが選択されている場合：選択範囲を囲む
        newText = value.substring(0, start) + prefix + selectedText + suffix + value.substring(end);
        newCursorPos = start + prefix.length + selectedText.length + suffix.length;
      } else {
        // 選択されていない場合：カーソル位置に挿入
        newText = value.substring(0, start) + prefix + suffix + value.substring(end);
        newCursorPos = start + prefix.length;
      }

      onChange(newText);

      // カーソル位置を更新（非同期で行う必要がある）
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    },
    [value, onChange]
  );

  return (
    <div className={`border border-border rounded-lg overflow-hidden bg-background-secondary ${className}`}>
      {/* タブ */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setMode('write')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'write'
              ? 'text-foreground border-b-2 border-accent -mb-px'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          Write
        </button>
        <button
          type="button"
          onClick={() => setMode('preview')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'preview'
              ? 'text-foreground border-b-2 border-accent -mb-px'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          Preview
        </button>
      </div>

      {/* ツールバー（Writeモードのみ） */}
      {mode === 'write' && (
        <MarkdownToolbar textareaRef={textareaRef} onInsert={handleInsert} />
      )}

      {/* エディタ / プレビュー */}
      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-3 py-2 text-sm bg-transparent border-none resize-none focus:outline-none focus:ring-0 placeholder:text-foreground-subtle"
        />
      ) : (
        <div className="px-3 py-2 min-h-[100px]">
          {value ? (
            <MarkdownPreview content={value} />
          ) : (
            <p className="text-sm text-foreground-muted">プレビューするコンテンツがありません</p>
          )}
        </div>
      )}
    </div>
  );
}
