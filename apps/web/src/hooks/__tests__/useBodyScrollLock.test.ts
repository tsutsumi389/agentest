import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBodyScrollLock } from '../useBodyScrollLock';

describe('useBodyScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });
  it('isLocked=trueの場合にbodyのoverflowをhiddenにする', () => {
    renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('isLocked=falseの場合はoverflowを変更しない', () => {
    const originalOverflow = document.body.style.overflow;
    renderHook(() => useBodyScrollLock(false));
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('アンマウント時にoverflowを復元しスクロール位置を戻す', () => {
    document.body.style.overflow = '';
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('isLockedをfalseに変更するとoverflowが復元される', () => {
    document.body.style.overflow = '';
    const { rerender } = renderHook(({ locked }) => useBodyScrollLock(locked), {
      initialProps: { locked: true },
    });
    expect(document.body.style.overflow).toBe('hidden');

    rerender({ locked: false });
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
