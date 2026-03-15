import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

interface ImagePreviewModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean;
  /** 画像URL */
  imageUrl: string;
  /** ファイル名 */
  fileName: string;
  /** 閉じるハンドラ */
  onClose: () => void;
}

/**
 * 画像プレビューモーダル
 * サムネイルクリック時に画像を拡大表示する
 */
export function ImagePreviewModal({ isOpen, imageUrl, fileName, onClose }: ImagePreviewModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [hasError, setHasError] = useState(false);

  // imageUrl変更時にエラー状態をリセット
  useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  // ESCキーでモーダルを閉じる + フォーカストラップ + 背景スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // フォーカスを閉じるボタンに移動
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      // フォーカストラップ
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements =
          modalRef.current.querySelectorAll<HTMLElement>('button:not([disabled])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center">
      {/* オーバーレイ */}
      <div
        data-testid="image-preview-overlay"
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* コンテンツ */}
      <div
        ref={modalRef}
        className="relative flex flex-col items-center"
        role="dialog"
        aria-modal="true"
        aria-label={fileName}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 p-1 text-white/70 hover:text-white transition-colors"
          aria-label="閉じる"
        >
          <X className="w-6 h-6" />
        </button>

        {/* 画像 */}
        {hasError ? (
          <div className="flex items-center justify-center w-64 h-64 bg-background-secondary rounded">
            <p className="text-sm text-foreground-muted">画像を読み込めませんでした</p>
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={fileName}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded"
            onError={() => setHasError(true)}
          />
        )}

        {/* ファイル名 */}
        <p className="mt-2 text-sm text-white/80">{fileName}</p>
      </div>
    </div>
  );
}
