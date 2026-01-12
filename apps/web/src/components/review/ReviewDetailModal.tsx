import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { reviewsApi } from '../../lib/api';
import { ReviewDetailContent } from './ReviewDetailContent';

interface ReviewDetailModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean;
  /** レビューID */
  reviewId: string | null;
  /** 閉じる際のコールバック */
  onClose: () => void;
}

/**
 * レビュー詳細モーダルコンポーネント
 * 提出済みレビューの詳細とコメント一覧を表示
 */
export function ReviewDetailModal({
  isOpen,
  reviewId,
  onClose,
}: ReviewDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // レビュー詳細を取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['review-detail', reviewId],
    queryFn: () => reviewsApi.getById(reviewId!),
    enabled: isOpen && !!reviewId,
  });

  const review = data?.review;

  // ESCキーでモーダルを閉じる + フォーカストラップ + 背景スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    // 背景スクロールを無効化
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
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

    // フォーカスをモーダルに移動
    closeButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-detail-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2
            id="review-detail-title"
            className="text-lg font-semibold text-foreground"
          >
            レビュー詳細
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
              <p className="text-sm">レビューの読み込みに失敗しました</p>
            </div>
          ) : review ? (
            <ReviewDetailContent review={review} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
