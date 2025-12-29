import { useState, useEffect } from 'react';

/**
 * 値をデバウンスするカスタムフック
 * 指定した遅延時間の間、値の更新がなければ最新の値を返す
 *
 * @param value デバウンスする値
 * @param delay デバウンス遅延時間（ミリ秒）
 * @returns デバウンスされた値
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 遅延後に値を更新するタイマーをセット
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // クリーンアップ: 次のrender時に前のタイマーをキャンセル
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
