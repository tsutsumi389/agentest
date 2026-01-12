import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, FileEdit, Loader2 } from 'lucide-react';
import { reviewsApi, type ReviewVerdict } from '../../lib/api';
import { useReviewSession } from '../../contexts/ReviewSessionContext';
import { ReviewList } from './ReviewList';
import { ReviewDetailModal } from './ReviewDetailModal';

interface ReviewPanelProps {
  /** テストスイートID */
  testSuiteId: string;
}

/**
 * レビューパネルコンポーネント
 * テストスイートのレビュータブのメインコンテンツ
 */
export function ReviewPanel({ testSuiteId }: ReviewPanelProps) {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<ReviewVerdict | 'ALL'>(
    'ALL'
  );

  const { isReviewing, startReview, isLoading: isStarting } = useReviewSession();

  // 提出済みレビュー一覧を取得
  const { data: reviewsData, isLoading: isLoadingReviews } = useQuery({
    queryKey: ['test-suite-reviews', testSuiteId, verdictFilter],
    queryFn: () =>
      reviewsApi.getByTestSuite(testSuiteId, {
        verdict: verdictFilter === 'ALL' ? undefined : verdictFilter,
        limit: 50,
        offset: 0,
      }),
    enabled: !!testSuiteId,
  });

  // 自分の下書きレビュー一覧を取得
  const { data: draftsData, isLoading: isLoadingDrafts } = useQuery({
    queryKey: ['review-drafts'],
    queryFn: () => reviewsApi.getDrafts(),
  });

  const reviews = reviewsData?.reviews || [];
  const drafts = draftsData?.reviews || [];

  // このテストスイートに対する自分の下書きがあるか
  const myDraft = drafts.find((d) => d.testSuiteId === testSuiteId);

  // レビュー開始ハンドラ
  const handleStartReview = async () => {
    if (isReviewing) return;
    try {
      await startReview(testSuiteId);
    } catch {
      // エラーはContextで処理される
    }
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー部分 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* レビュー開始ボタン */}
          {!isReviewing && (
            <button
              type="button"
              onClick={handleStartReview}
              disabled={isStarting}
              className="btn btn-primary"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  開始中...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  レビューを開始
                </>
              )}
            </button>
          )}

          {/* 下書きがある場合 */}
          {myDraft && !isReviewing && (
            <DraftIndicator
              reviewId={myDraft.id}
              commentCount={myDraft._count.comments}
            />
          )}
        </div>

        {/* フィルター */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground-muted">フィルター:</span>
          <select
            value={verdictFilter}
            onChange={(e) =>
              setVerdictFilter(e.target.value as ReviewVerdict | 'ALL')
            }
            className="input text-sm py-1.5"
          >
            <option value="ALL">すべて</option>
            <option value="APPROVED">承認</option>
            <option value="CHANGES_REQUESTED">要修正</option>
            <option value="COMMENT_ONLY">コメントのみ</option>
          </select>
        </div>
      </div>

      {/* 他のテストスイートの下書きがある場合のみ表示 */}
      {!isLoadingDrafts && drafts.length > (myDraft ? 1 : 0) && (
        <div className="p-3 bg-background-secondary rounded-lg">
          <div className="text-sm text-foreground-muted mb-2">
            他のテストスイートの下書き ({drafts.length - (myDraft ? 1 : 0)}件)
          </div>
          <div className="text-xs text-foreground-muted">
            下書き一覧は「自分の下書き」メニューから確認できます
          </div>
        </div>
      )}

      {/* レビュー一覧 */}
      <ReviewList
        reviews={reviews}
        isLoading={isLoadingReviews}
        onReviewClick={setSelectedReviewId}
      />

      {/* 詳細モーダル */}
      <ReviewDetailModal
        isOpen={selectedReviewId !== null}
        reviewId={selectedReviewId}
        onClose={() => setSelectedReviewId(null)}
      />
    </div>
  );
}

/**
 * 下書きインジケーター
 */
function DraftIndicator({
  reviewId,
  commentCount,
}: {
  reviewId: string;
  commentCount: number;
}) {
  const { loadDraftReview, isLoading } = useReviewSession();

  const handleLoadDraft = async () => {
    try {
      await loadDraftReview(reviewId);
    } catch {
      // エラーはContextで処理される
    }
  };

  return (
    <button
      type="button"
      onClick={handleLoadDraft}
      disabled={isLoading}
      className="flex items-center gap-2 px-3 py-1.5 text-sm bg-warning-subtle text-warning rounded-lg hover:bg-warning/20 transition-colors"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileEdit className="w-4 h-4" />
      )}
      <span>下書きを再開 ({commentCount}件のコメント)</span>
    </button>
  );
}
