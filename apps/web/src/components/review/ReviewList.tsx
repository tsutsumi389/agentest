import { Loader2, MessageSquareOff } from 'lucide-react';
import type { ReviewWithAuthor } from '../../lib/api';
import { ReviewItem } from './ReviewItem';

interface ReviewListProps {
  /** レビュー一覧 */
  reviews: ReviewWithAuthor[];
  /** ローディング状態 */
  isLoading: boolean;
  /** レビュークリック時のコールバック */
  onReviewClick: (reviewId: string) => void;
}

/**
 * レビュー一覧コンポーネント
 * 提出済みレビューのリスト表示
 */
export function ReviewList({ reviews, isLoading, onReviewClick }: ReviewListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
        <MessageSquareOff className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm">まだレビューがありません</p>
        <p className="text-xs mt-1">「レビューを開始」ボタンからレビューを投稿できます</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewItem key={review.id} review={review} onClick={() => onReviewClick(review.id)} />
      ))}
    </div>
  );
}
