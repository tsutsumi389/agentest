import { useEffect } from 'react';

/**
 * モーダル等が開いている間、背景のスクロールを無効化するフック
 *
 * @param isLocked - スクロールをロックするかどうか
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (isLocked) {
      // 現在のスクロール位置を保存
      const scrollY = window.scrollY;
      const originalStyle = window.getComputedStyle(document.body).overflow;

      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalStyle;
        // スクロール位置を復元（必要な場合）
        window.scrollTo(0, scrollY);
      };
    }
  }, [isLocked]);
}
