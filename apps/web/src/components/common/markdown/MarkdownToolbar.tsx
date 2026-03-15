import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

/**
 * ツールバーアクションの定義（アイコンは遅延評価）
 */
interface ToolbarActionDef {
  Icon: LucideIcon;
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean; // 行頭に挿入するタイプか
  shortcut?: string; // キーボードショートカット（表示用）
}

// パフォーマンス最適化: アクション定義をコンポーネント外で定数化
const TOOLBAR_ACTIONS: ToolbarActionDef[] = [
  { Icon: Bold, label: '太字', prefix: '**', suffix: '**', shortcut: 'Ctrl+B' },
  { Icon: Italic, label: '斜体', prefix: '*', suffix: '*', shortcut: 'Ctrl+I' },
  { Icon: Strikethrough, label: '取り消し線', prefix: '~~', suffix: '~~' },
  { Icon: List, label: '箇条書き', prefix: '- ', suffix: '', block: true },
  { Icon: ListOrdered, label: '番号付き', prefix: '1. ', suffix: '', block: true },
  { Icon: Quote, label: '引用', prefix: '> ', suffix: '', block: true },
  { Icon: Code, label: 'コード', prefix: '`', suffix: '`' },
  { Icon: Link, label: 'リンク', prefix: '[', suffix: '](url)', shortcut: 'Ctrl+K' },
];

interface MarkdownToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onInsert: (prefix: string, suffix: string, block?: boolean) => void;
}

/**
 * Markdownツールバーコンポーネント
 * テキストエリアに書式を挿入するためのボタン群
 */
export function MarkdownToolbar({ textareaRef, onInsert }: MarkdownToolbarProps) {
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  // 見出しメニューの外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headingRef.current && !headingRef.current.contains(event.target as Node)) {
        setHeadingMenuOpen(false);
      }
    };

    if (headingMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [headingMenuOpen]);

  const handleAction = (action: ToolbarActionDef) => {
    onInsert(action.prefix, action.suffix, action.block);
    textareaRef.current?.focus();
  };

  const handleHeadingSelect = (level: number) => {
    const prefix = '#'.repeat(level) + ' ';
    onInsert(prefix, '', true);
    setHeadingMenuOpen(false);
    textareaRef.current?.focus();
  };

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 border-b border-border bg-background-tertiary"
      role="toolbar"
      aria-label="書式ツールバー"
    >
      {/* 見出しドロップダウン */}
      <div ref={headingRef} className="relative">
        <button
          type="button"
          onClick={() => setHeadingMenuOpen(!headingMenuOpen)}
          className="flex items-center gap-0.5 px-2 py-1 text-sm text-foreground-muted hover:text-foreground hover:bg-background-secondary rounded transition-colors"
          title="見出し"
          aria-label="見出し"
          aria-expanded={headingMenuOpen}
          aria-haspopup="menu"
        >
          <span className="font-bold">H</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        {headingMenuOpen && (
          <div
            className="absolute top-full left-0 mt-1 bg-background-secondary border border-border rounded shadow-lg z-10"
            role="menu"
          >
            {[1, 2, 3].map((level) => (
              <button
                key={level}
                type="button"
                role="menuitem"
                onClick={() => handleHeadingSelect(level)}
                className="block w-full px-3 py-1.5 text-left text-sm text-foreground hover:bg-background-tertiary"
              >
                <span className="font-bold">H{level}</span>
                <span className="ml-2 text-foreground-muted">見出し{level}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-border mx-1" aria-hidden="true" />

      {/* その他のアクションボタン */}
      {TOOLBAR_ACTIONS.map((action) => {
        const tooltip = action.shortcut ? `${action.label} (${action.shortcut})` : action.label;
        return (
          <button
            key={action.label}
            type="button"
            onClick={() => handleAction(action)}
            className="p-1.5 text-foreground-muted hover:text-foreground hover:bg-background-secondary rounded transition-colors"
            title={tooltip}
            aria-label={tooltip}
          >
            <action.Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
