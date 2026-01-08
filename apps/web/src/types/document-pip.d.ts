/**
 * Document Picture-in-Picture API の型定義
 *
 * @see https://developer.chrome.com/docs/web-platform/document-picture-in-picture
 * @see https://wicg.github.io/document-picture-in-picture/
 *
 * ブラウザサポート: Chrome 116+ のみ
 */

/**
 * Document Picture-in-Picture ウィンドウオプション
 */
interface DocumentPictureInPictureOptions {
  /** PiPウィンドウの初期幅（ピクセル） */
  width?: number;
  /** PiPウィンドウの初期高さ（ピクセル） */
  height?: number;
  /**
   * メインウィンドウからPiPウィンドウにフォーカスを移すかどうか
   * @default false
   */
  disallowReturnToOpener?: boolean;
}

/**
 * Document Picture-in-Picture API のメインインターフェース
 */
interface DocumentPictureInPicture extends EventTarget {
  /**
   * 新しい Picture-in-Picture ウィンドウを開く
   * @param options - ウィンドウオプション
   * @returns 開いたウィンドウのPromise
   */
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;

  /**
   * 現在開いている PiP ウィンドウ（なければ null）
   */
  readonly window: Window | null;

  /**
   * PiPウィンドウが開いた時のイベント
   */
  onenter: ((this: DocumentPictureInPicture, ev: DocumentPictureInPictureEvent) => void) | null;
}

/**
 * Document Picture-in-Picture イベント
 */
interface DocumentPictureInPictureEvent extends Event {
  /** 開いた PiP ウィンドウ */
  readonly window: Window;
}

/**
 * グローバル Window インターフェースの拡張
 */
declare global {
  interface Window {
    /**
     * Document Picture-in-Picture API
     * Chrome 116+ でのみ利用可能
     */
    documentPictureInPicture?: DocumentPictureInPicture;
  }
}

export {};
