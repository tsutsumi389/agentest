import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageVisibility } from '../usePageVisibility';

describe('usePageVisibility', () => {
  it('初期状態でisVisible=true, isHidden=falseを返す', () => {
    const { result } = renderHook(() => usePageVisibility());
    // jsdomではデフォルトでvisible
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isHidden).toBe(false);
  });

  it('visibilitychangeイベントで状態が更新される', () => {
    const { result } = renderHook(() => usePageVisibility());

    // hiddenに変更
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isVisible).toBe(false);
    expect(result.current.isHidden).toBe(true);

    // visibleに戻す
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current.isVisible).toBe(true);
    expect(result.current.isHidden).toBe(false);
  });

  it('アンマウント時にイベントリスナーが解除される', () => {
    const { unmount } = renderHook(() => usePageVisibility());

    unmount();

    // アンマウント後にイベントが発火してもエラーにならない
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
});
