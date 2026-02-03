import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('初期値をそのまま返す', () => {
    const { result } = renderHook(() => useDebounce('initial'));
    expect(result.current).toBe('initial');
  });

  it('遅延後に値が更新される', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    // まだ更新されていない
    expect(result.current).toBe('initial');

    // 300ms経過
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('updated');
  });

  it('遅延内の値変更はキャンセルされる', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'first' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'second' });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: 'third' });
    // まだ初期値
    expect(result.current).toBe('initial');

    // 最後の変更から300ms経過
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('third');
  });

  it('デフォルトの遅延は300ms', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('数値型でも動作する', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 0 } }
    );

    rerender({ value: 42 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(42);
  });
});
