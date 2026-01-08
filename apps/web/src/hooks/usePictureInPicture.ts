import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * usePictureInPicture のオプション
 */
export interface UsePictureInPictureOptions {
  /** PiPウィンドウの初期幅（デフォルト: 400） */
  width?: number;
  /** PiPウィンドウの初期高さ（デフォルト: 300） */
  height?: number;
  /** PiPウィンドウが開いた時のコールバック */
  onOpen?: () => void;
  /** PiPウィンドウが閉じた時のコールバック */
  onClose?: () => void;
}

/**
 * usePictureInPicture の戻り値型
 */
export interface UsePictureInPictureReturn {
  /** 現在開いているPiPウィンドウ（なければnull） */
  pipWindow: Window | null;
  /** Document Picture-in-Picture API がサポートされているか */
  isPipSupported: boolean;
  /** PiPウィンドウが開いているか */
  isPipActive: boolean;
  /** PiPウィンドウを開く */
  openPip: () => Promise<void>;
  /** PiPウィンドウを閉じる */
  closePip: () => void;
}

/**
 * Document Picture-in-Picture API がサポートされているかチェック
 */
function checkPipSupport(): boolean {
  return typeof window !== 'undefined' && 'documentPictureInPicture' in window;
}

/**
 * 親ウィンドウのスタイルシートをPiPウィンドウにコピー
 */
function copyStylesToPipWindow(pipWindow: Window): void {
  // 既存のスタイルシートをコピー
  [...document.styleSheets].forEach((styleSheet) => {
    try {
      // 同一オリジンのスタイルシートはCSSルールを直接コピー
      const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
      const style = document.createElement('style');
      style.textContent = cssRules;
      pipWindow.document.head.appendChild(style);
    } catch {
      // CORSエラーの場合はlinkタグで参照
      if (styleSheet.href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = styleSheet.href;
        pipWindow.document.head.appendChild(link);
      }
    }
  });
}

/**
 * Document Picture-in-Picture API のラッパーフック
 *
 * ブラウザタブがバックグラウンドになった時に、小さなフローティングウィンドウに
 * コンテンツを表示するための API をラップします。
 *
 * 対応ブラウザ: Chrome 116+ のみ
 *
 * @example
 * ```tsx
 * const { pipWindow, isPipSupported, isPipActive, openPip, closePip } = usePictureInPicture({
 *   width: 400,
 *   height: 300,
 *   onOpen: () => console.log('PiP opened'),
 *   onClose: () => console.log('PiP closed'),
 * });
 *
 * // PiPウィンドウを開く
 * await openPip();
 *
 * // PipPortalコンポーネントでコンテンツをレンダリング
 * <PipPortal pipWindow={pipWindow}>
 *   <MyContent />
 * </PipPortal>
 * ```
 */
export function usePictureInPicture(
  options: UsePictureInPictureOptions = {}
): UsePictureInPictureReturn {
  const { width = 400, height = 300, onOpen, onClose } = options;

  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const [isPipSupported] = useState<boolean>(checkPipSupport);

  // コールバックをrefで保持（依存配列の問題を回避）
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  }, [onOpen, onClose]);

  /**
   * PiPウィンドウを開く
   */
  const openPip = useCallback(async () => {
    if (!isPipSupported) {
      console.warn('Document Picture-in-Picture API is not supported');
      return;
    }

    // 既に開いている場合は何もしない
    if (pipWindow && !pipWindow.closed) {
      pipWindow.focus();
      return;
    }

    try {
      const newPipWindow = await window.documentPictureInPicture!.requestWindow({
        width,
        height,
      });

      // スタイルシートをコピー
      copyStylesToPipWindow(newPipWindow);

      // 閉じた時のハンドラを設定
      newPipWindow.addEventListener('pagehide', () => {
        setPipWindow(null);
        onCloseRef.current?.();
      });

      setPipWindow(newPipWindow);
      onOpenRef.current?.();
    } catch (error) {
      console.error('Failed to open Picture-in-Picture window:', error);
    }
  }, [isPipSupported, pipWindow, width, height]);

  /**
   * PiPウィンドウを閉じる
   */
  const closePip = useCallback(() => {
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
      // pagehideイベントでsetPipWindow(null)が呼ばれる
    }
  }, [pipWindow]);

  // コンポーネントのアンマウント時にPiPウィンドウを閉じる
  useEffect(() => {
    return () => {
      if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
      }
    };
  }, [pipWindow]);

  return {
    pipWindow,
    isPipSupported,
    isPipActive: pipWindow !== null && !pipWindow.closed,
    openPip,
    closePip,
  };
}
