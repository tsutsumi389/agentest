import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, useShortcut, formatShortcut } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  // テストで追加されたinput要素を追跡してクリーンアップ
  let appendedInputs: HTMLElement[] = [];

  afterEach(() => {
    for (const el of appendedInputs) {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
    appendedInputs = [];
  });

  /**
   * テスト用にinput要素をDOMに追加する
   * afterEachで自動的にクリーンアップされる
   */
  function appendTestInput(): HTMLInputElement {
    const input = document.createElement('input');
    document.body.appendChild(input);
    appendedInputs.push(input);
    return input;
  }

  it('ショートカットキーでアクションが実行される', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', action }]));

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('修飾キーなしのショートカットが正しく動作する', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'escape', action }]));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('入力フィールド内ではデフォルトで発火しない', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', action }]));

    const input = appendTestInput();
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);
    expect(action).not.toHaveBeenCalled();
  });

  it('enableInInput=trueの場合は入力フィールド内でも発火する', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'escape', action, enableInInput: true }]));

    const input = appendTestInput();
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('アンマウント時にリスナーが解除される', () => {
    const action = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts([{ key: 'k', action }]));

    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(action).not.toHaveBeenCalled();
  });

  it('meta修飾キー付きのショートカットが動作する（Ctrl: non-Mac）', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', meta: true, action }]));

    // metaなしでは発火しない
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(action).not.toHaveBeenCalled();

    // Ctrl付きで発火する（non-Mac環境でのmeta相当）
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('meta修飾キー付きのショートカットが動作する（metaKey: Mac）', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', meta: true, action }]));

    // jsdomはnon-Mac環境のため、metaKeyではなくctrlKeyがmeta扱い
    // metaKeyのみでは発火しないことを確認
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    // non-Mac環境ではmetaKeyはmeta修飾としてマッチしない
    expect(action).not.toHaveBeenCalled();
  });

  it('shift修飾キー付きのショートカットが動作する', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', shift: true, action }]));

    // shiftなしでは発火しない
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(action).not.toHaveBeenCalled();

    // shift付きで発火する
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', shiftKey: true }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('alt修飾キー付きのショートカットが動作する', () => {
    const action = vi.fn();
    renderHook(() => useKeyboardShortcuts([{ key: 'k', alt: true, action }]));

    // altなしでは発火しない
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(action).not.toHaveBeenCalled();

    // alt付きで発火する
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', altKey: true }));
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('useShortcut', () => {
  it('単一ショートカットを登録する', () => {
    const action = vi.fn();
    renderHook(() => useShortcut('j', action));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('formatShortcut', () => {
  it('キーのみのショートカットをフォーマットする', () => {
    const result = formatShortcut({ key: 'k' });
    expect(result).toBe('K');
  });

  it('Escapeをフォーマットする', () => {
    const result = formatShortcut({ key: 'escape' });
    expect(result).toBe('Esc');
  });

  it('Enterをフォーマットする', () => {
    const result = formatShortcut({ key: 'enter' });
    expect(result).toBe('↵');
  });

  it('スペースをフォーマットする', () => {
    const result = formatShortcut({ key: ' ' });
    expect(result).toBe('Space');
  });

  it('矢印キーをフォーマットする', () => {
    expect(formatShortcut({ key: 'arrowup' })).toBe('↑');
    expect(formatShortcut({ key: 'arrowdown' })).toBe('↓');
    expect(formatShortcut({ key: 'arrowleft' })).toBe('←');
    expect(formatShortcut({ key: 'arrowright' })).toBe('→');
  });

  it('修飾キー付きショートカットをフォーマットする', () => {
    // non-Mac環境（jsdom）での表示
    const result = formatShortcut({ key: 'k', meta: true, shift: true });
    expect(result).toContain('Ctrl');
    expect(result).toContain('Shift');
    expect(result).toContain('K');
  });
});
