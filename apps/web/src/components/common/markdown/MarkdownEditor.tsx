import { useState, useRef, useCallback, useMemo } from 'react';
import { MarkdownToolbar } from './MarkdownToolbar';
import { MarkdownPreview } from './MarkdownPreview';

type TabMode = 'write' | 'preview';

interface MarkdownEditorProps {
  /** ラベル関連付け用のID */
  id?: string;
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
  id,
  value,
  onChange,
  placeholder = '',
  rows = 4,
  className = '',
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<TabMode>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // プレビューの最小高さをrowsと連動
  const previewMinHeight = useMemo(() => `${rows * 1.5}rem`, [rows]);

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

  // キーボードショートカットハンドラ
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      }
    },
    [handleInsert]
  );

  return (
    <div className={`border border-border rounded-lg overflow-hidden bg-background-secondary ${className}`}>
      {/* タブ */}
      <div className="flex border-b border-border" role="tablist" aria-label="エディタモード">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'write'}
          aria-controls="editor-panel"
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
          role="tab"
          aria-selected={mode === 'preview'}
          aria-controls="preview-panel"
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
        <div id="editor-panel" role="tabpanel" aria-labelledby="write-tab">
          <textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-3 py-2 text-sm bg-transparent border-none resize-none focus:outline-none focus:ring-0 placeholder:text-foreground-subtle"
          />
        </div>
      ) : (
        <div
          id="preview-panel"
          role="tabpanel"
          aria-labelledby="preview-tab"
          className="px-3 py-2"
          style={{ minHeight: previewMinHeight }}
        >
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
