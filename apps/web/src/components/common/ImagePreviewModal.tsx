import { useEffect } from 'react';
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
export function ImagePreviewModal({
  isOpen,
  imageUrl,
  fileName,
  onClose,
}: ImagePreviewModalProps) {
  // ESCキーでモーダルを閉じる + 背景スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 p-1 text-white/70 hover:text-white transition-colors"
          aria-label="閉じる"
        >
          <X className="w-6 h-6" />
        </button>

        {/* 画像 */}
        <img
          src={imageUrl}
          alt={fileName}
          className="max-w-[90vw] max-h-[85vh] object-contain rounded"
        />

        {/* ファイル名 */}
        <p className="mt-2 text-sm text-white/80">{fileName}</p>
      </div>
    </div>
  );
}
