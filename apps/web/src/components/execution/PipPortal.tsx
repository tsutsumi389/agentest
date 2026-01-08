import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * PipPortal のプロパティ
 */
interface PipPortalProps {
  /** usePictureInPicture から取得した PiP ウィンドウ */
  pipWindow: Window | null;
  /** PiP ウィンドウ内に表示するコンテンツ */
  children: React.ReactNode;
}

/**
 * Picture-in-Picture ウィンドウにコンテンツをレンダリングする Portal
 *
 * usePictureInPicture フックと組み合わせて使用し、
 * PiP ウィンドウ内に React コンポーネントをレンダリングします。
 *
 * @example
 * ```tsx
 * const { pipWindow, openPip } = usePictureInPicture();
 *
 * return (
 *   <>
 *     <button onClick={openPip}>PiP を開く</button>
 *     <PipPortal pipWindow={pipWindow}>
 *       <div className="p-4">
 *         <h1>PiP コンテンツ</h1>
 *       </div>
 *     </PipPortal>
 *   </>
 * );
 * ```
 */
export function PipPortal({ pipWindow, children }: PipPortalProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!pipWindow || pipWindow.closed) {
      setContainer(null);
      return;
    }

    // PiP ウィンドウの body をコンテナとして使用
    const pipBody = pipWindow.document.body;

    // コンテナ要素を作成してマウント
    const containerElement = pipWindow.document.createElement('div');
    containerElement.id = 'pip-portal-root';
    pipBody.appendChild(containerElement);

    setContainer(containerElement);

    return () => {
      // クリーンアップ時にコンテナを削除
      containerElement.remove();
    };
  }, [pipWindow]);

  // PiP ウィンドウがない、または閉じている場合は何もレンダリングしない
  if (!pipWindow || pipWindow.closed || !container) {
    return null;
  }

  return createPortal(children, container);
}
