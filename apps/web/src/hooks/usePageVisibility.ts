import { useState, useEffect, useCallback } from 'react';

/**
 * usePageVisibility の戻り値型
 */
export interface UsePageVisibilityReturn {
  /** ページが可視状態か */
  isVisible: boolean;
  /** ページが非表示状態か */
  isHidden: boolean;
}

/**
 * Page Visibility API のラッパーフック
 *
 * ブラウザタブの可視性状態を監視し、タブがフォアグラウンド/バックグラウンドに
 * 移動した際に状態を更新します。
 *
 * 主な用途:
 * - タブがバックグラウンドになった時にPicture-in-Pictureを自動起動
 * - 非表示時にリソースを節約（アニメーション停止等）
 *
 * @example
 * ```tsx
 * const { isVisible, isHidden } = usePageVisibility();
 *
 * useEffect(() => {
 *   if (isHidden) {
 *     // タブがバックグラウンドになった
 *     openPictureInPicture();
 *   }
 * }, [isHidden]);
 * ```
 */
export function usePageVisibility(): UsePageVisibilityReturn {
  // SSR対応: document が存在しない場合は visible として扱う
  const getVisibilityState = useCallback(() => {
    if (typeof document === 'undefined') {
      return 'visible';
    }
    return document.visibilityState;
  }, []);

  const [visibilityState, setVisibilityState] = useState<DocumentVisibilityState>(
    getVisibilityState
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      setVisibilityState(document.visibilityState);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    isVisible: visibilityState === 'visible',
    isHidden: visibilityState === 'hidden',
  };
}
