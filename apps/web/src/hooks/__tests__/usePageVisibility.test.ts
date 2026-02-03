import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePageVisibility } from '../usePageVisibility';

describe('usePageVisibility', () => {
  afterEach(() => {
    // visibilityStateをデフォルトに復元
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

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
    const { result, unmount } = renderHook(() => usePageVisibility());

    // アンマウント前の状態を確認
    expect(result.current.isVisible).toBe(true);

    unmount();

    // アンマウント後にイベントが発火しても状態は変わらない
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    // アンマウント後は最後の状態が維持される
    expect(result.current.isVisible).toBe(true);
    expect(result.current.isHidden).toBe(false);
  });
});
