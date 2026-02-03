import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts, useShortcut, formatShortcut } from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  it('ショートカットキーでアクションが実行される', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'k', action }])
    );

    const event = new KeyboardEvent('keydown', { key: 'k' });
    window.dispatchEvent(event);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('修飾キーなしのショートカットが正しく動作する', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'escape', action }])
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('入力フィールド内ではデフォルトで発火しない', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'k', action }])
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);
    expect(action).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('enableInInput=trueの場合は入力フィールド内でも発火する', () => {
    const action = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ key: 'escape', action, enableInInput: true }])
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);
    expect(action).toHaveBeenCalledTimes(1);
    document.body.removeChild(input);
  });

  it('アンマウント時にリスナーが解除される', () => {
    const action = vi.fn();
    const { unmount } = renderHook(() =>
      useKeyboardShortcuts([{ key: 'k', action }])
    );

    unmount();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(action).not.toHaveBeenCalled();
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
});
