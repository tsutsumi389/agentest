import { useEffect, useCallback } from 'react';

/**
 * ショートカット定義の型
 */
export interface ShortcutConfig {
  /** キー（小文字） */
  key: string;
  /** Ctrl/Cmd キーが必要か */
  meta?: boolean;
  /** Shift キーが必要か */
  shift?: boolean;
  /** Alt キーが必要か */
  alt?: boolean;
  /** 実行するアクション */
  action: () => void;
  /** 説明（ヘルプ表示用） */
  description?: string;
  /** 入力フィールドでも発火するか */
  enableInInput?: boolean;
}

/**
 * プラットフォーム判定
 */
const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

/**
 * キーボードショートカットフック
 * グローバルなキーボードショートカットを登録
 */
export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 入力フィールド内かチェック
      const isInput =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement)?.tagName) ||
        (event.target as HTMLElement)?.isContentEditable;

      for (const shortcut of shortcuts) {
        // 入力フィールド内で無効なショートカットはスキップ
        if (isInput && !shortcut.enableInInput) {
          continue;
        }

        // メタキーチェック（Mac: Cmd, Windows: Ctrl）
        const metaMatch = shortcut.meta
          ? isMac
            ? event.metaKey
            : event.ctrlKey
          : !(isMac ? event.metaKey : event.ctrlKey);

        // 各修飾キーチェック
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (metaMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

/**
 * 単一ショートカット用の簡易フック
 */
export function useShortcut(
  key: string,
  action: () => void,
  options: Omit<ShortcutConfig, 'key' | 'action'> = {}
) {
  useKeyboardShortcuts([{ key, action, ...options }]);
}

/**
 * ショートカット表示用のヘルパー
 * プラットフォームに応じた記号を返す
 */
export function formatShortcut(shortcut: Omit<ShortcutConfig, 'action'>): string {
  const parts: string[] = [];

  if (shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }

  // 特殊キーの表示
  const keyDisplay: Record<string, string> = {
    escape: 'Esc',
    enter: '↵',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    ' ': 'Space',
  };

  parts.push(keyDisplay[shortcut.key.toLowerCase()] || shortcut.key.toUpperCase());

  return parts.join(isMac ? '' : '+');
}
