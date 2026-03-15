import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Search, LayoutDashboard, FolderKanban, Settings, FileText, Command } from 'lucide-react';
import { useShortcut, formatShortcut } from '../hooks/useKeyboardShortcuts';

/**
 * コマンドアイテムの型定義
 */
interface CommandItem {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: { key: string; meta?: boolean; shift?: boolean };
  category: 'navigation' | 'action' | 'recent';
}

interface CommandPaletteProps {
  /** 追加のコマンド */
  additionalCommands?: CommandItem[];
}

/**
 * コマンドパレットコンポーネント
 * ⌘+K で起動するクイックアクセスUI
 */
export function CommandPalette({ additionalCommands = [] }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // ⌘+K でパレットを開く
  useShortcut('k', () => setIsOpen(true), { meta: true });

  // デフォルトのコマンド
  const defaultCommands: CommandItem[] = useMemo(
    () => [
      {
        id: 'nav-dashboard',
        label: 'ダッシュボードに移動',
        icon: LayoutDashboard,
        action: () => navigate('/dashboard'),
        category: 'navigation',
      },
      {
        id: 'nav-projects',
        label: 'プロジェクト一覧に移動',
        icon: FolderKanban,
        action: () => navigate('/projects'),
        category: 'navigation',
      },
      {
        id: 'nav-settings',
        label: '設定を開く',
        icon: Settings,
        action: () => navigate('/settings'),
        category: 'navigation',
      },
      {
        id: 'action-new-project',
        label: '新規プロジェクト作成',
        icon: FolderKanban,
        action: () => {
          navigate('/projects');
          // 少し遅延してモーダルを開くトリガーを発火させることも可能
        },
        category: 'action',
      },
      {
        id: 'action-new-test',
        label: '新規テストスイート作成',
        icon: FileText,
        action: () => navigate('/projects'),
        category: 'action',
      },
    ],
    [navigate]
  );

  // 全コマンド
  const allCommands = useMemo(
    () => [...defaultCommands, ...additionalCommands],
    [defaultCommands, additionalCommands]
  );

  // フィルタリング
  const filteredCommands = useMemo(() => {
    if (!query) return allCommands;
    const lowerQuery = query.toLowerCase();
    return allCommands.filter((cmd) => cmd.label.toLowerCase().includes(lowerQuery));
  }, [allCommands, query]);

  // パレットが開いたときにフォーカス
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // 選択インデックスのリセット
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // キーボードナビゲーション
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
        }
        break;
      case 'ArrowUp':
      case 'k':
        if (!e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // コマンド実行
  const executeCommand = (command: CommandItem) => {
    setIsOpen(false);
    command.action();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-modal flex items-start justify-center pt-[20vh]"
      onClick={() => setIsOpen(false)}
    >
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* パレット */}
      <div
        className="relative w-full max-w-lg bg-background-secondary border border-border rounded-lg shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 検索入力 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-5 h-5 text-foreground-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="コマンドを検索..."
            className="flex-1 bg-transparent text-foreground placeholder:text-foreground-subtle focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs font-mono text-foreground-muted bg-background-tertiary rounded">
            Esc
          </kbd>
        </div>

        {/* コマンドリスト */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-foreground-muted">
              一致するコマンドがありません
            </div>
          ) : (
            <div role="listbox" aria-label="コマンド">
              {filteredCommands.map((command, index) => {
                const Icon = command.icon;
                const isSelected = index === selectedIndex;

                return (
                  <button
                    key={command.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => executeCommand(command)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-2 text-left transition-colors
                      ${
                        isSelected
                          ? 'bg-accent-subtle text-foreground'
                          : 'text-foreground-muted hover:bg-background-tertiary hover:text-foreground'
                      }
                    `}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1">{command.label}</span>
                    {command.shortcut && (
                      <kbd className="px-2 py-0.5 text-xs font-mono text-foreground-subtle bg-background-tertiary rounded">
                        {formatShortcut(command.shortcut)}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border text-xs text-foreground-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono bg-background-tertiary rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 font-mono bg-background-tertiary rounded">↓</kbd>
              移動
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 font-mono bg-background-tertiary rounded">↵</kbd>
              実行
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Command className="w-3 h-3" />
            <span>コマンドパレット</span>
          </div>
        </div>
      </div>
    </div>
  );
}
