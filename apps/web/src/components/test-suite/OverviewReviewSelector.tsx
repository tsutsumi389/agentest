import { useQuery } from '@tanstack/react-query';
import { MessageSquare, Loader2 } from 'lucide-react';
import { reviewsApi, type ReviewVerdict } from '../../lib/api';
import { getAuthorDisplayName } from '../common/AuthorAvatar';
import { ReviewVerdictBadge } from '../review/ReviewVerdictBadge';

interface OverviewReviewSelectorProps {
  /** テストスイートID */
  testSuiteId: string;
  /** 選択中のレビューID */
  selectedReviewId: string | null;
  /** レビュー選択時のコールバック */
  onSelectReview: (reviewId: string | null) => void;
}

/**
 * 概要タブ用レビュー選択コンポーネント
 * 提出済みレビューを選択して、そのコメントを概要タブに表示するためのUI
 */
export function OverviewReviewSelector({
  testSuiteId,
  selectedReviewId,
  onSelectReview,
}: OverviewReviewSelectorProps) {
  // 提出済みレビュー一覧を取得
  // ReviewPanelと同じqueryKeyを使用してキャッシュを共有（フィルターなし = undefined）
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['test-suite-reviews', testSuiteId, undefined],
    queryFn: () => reviewsApi.getByTestSuite(testSuiteId, { limit: 50 }),
    enabled: !!testSuiteId,
  });

  const reviews = reviewsData?.reviews || [];

  // レビューがない場合は何も表示しない
  if (!isLoading && reviews.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-lg">
      <div className="flex items-center gap-2 text-foreground-muted">
        <MessageSquare className="w-4 h-4" />
        <span className="text-sm">レビューコメント表示:</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-foreground-muted">
          <Loader2 className="w-4 h-4 animate-spin" />
          読み込み中...
        </div>
      ) : (
        <select
          value={selectedReviewId || ''}
          onChange={(e) => onSelectReview(e.target.value || null)}
          className="input text-sm py-1.5 min-w-[200px]"
        >
          <option value="">なし</option>
          {reviews.map((review) => {
            const authorName = getAuthorDisplayName(review.author, review.agentSession);
            const submittedDate = review.submittedAt
              ? new Date(review.submittedAt).toLocaleDateString('ja-JP')
              : '';

            return (
              <option key={review.id} value={review.id}>
                {authorName} - {submittedDate}
                {review.verdict && ` (${getVerdictLabel(review.verdict)})`}
              </option>
            );
          })}
        </select>
      )}

      {/* 選択中のレビューのバッジ */}
      {selectedReviewId && !isLoading && (
        <SelectedReviewBadge
          reviewId={selectedReviewId}
          reviews={reviews}
        />
      )}
    </div>
  );
}

/**
 * 評価ラベルを取得
 */
function getVerdictLabel(verdict: string): string {
  switch (verdict) {
    case 'APPROVED':
      return '承認';
    case 'CHANGES_REQUESTED':
      return '要修正';
    case 'COMMENT_ONLY':
      return 'コメント';
    default:
      return verdict;
  }
}

/**
 * 選択中のレビューバッジ
 */
function SelectedReviewBadge({
  reviewId,
  reviews,
}: {
  reviewId: string;
  reviews: Array<{ id: string; verdict: ReviewVerdict | null }>;
}) {
  const review = reviews.find((r) => r.id === reviewId);
  if (!review?.verdict) return null;

  return <ReviewVerdictBadge verdict={review.verdict} />;
}
