import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, FileEdit, Loader2, ChevronLeft } from 'lucide-react';
import { reviewsApi, type ReviewVerdict } from '../../lib/api';
import { useReviewSession } from '../../contexts/ReviewSessionContext';
import { useAuth } from '../../hooks/useAuth';
import { ReviewList } from './ReviewList';
import { ReviewDetailContent } from './ReviewDetailContent';

interface ReviewPanelProps {
  /** テストスイートID */
  testSuiteId: string;
}

/**
 * レビューパネルコンポーネント
 * テストスイートのレビュータブのメインコンテンツ
 * レビュー一覧と詳細表示を切り替え
 */
export function ReviewPanel({ testSuiteId }: ReviewPanelProps) {
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [verdictFilter, setVerdictFilter] = useState<ReviewVerdict | 'ALL'>(
    'ALL'
  );

  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isReviewing, startReview, isLoading: isStarting } = useReviewSession();

  // 提出済みレビュー一覧を取得
  // ALLフィルター時はundefinedを使用してOverviewReviewSelectorとキャッシュを共有
  const verdictFilterForQuery = verdictFilter === 'ALL' ? undefined : verdictFilter;
  const { data: reviewsData, isLoading: isLoadingReviews } = useQuery({
    queryKey: ['test-suite-reviews', testSuiteId, verdictFilterForQuery],
    queryFn: () =>
      reviewsApi.getByTestSuite(testSuiteId, {
        verdict: verdictFilterForQuery,
        limit: 50,
        offset: 0,
      }),
    enabled: !!testSuiteId,
  });

  // 選択されたレビューの詳細を取得
  const { data: reviewDetailData, isLoading: isLoadingDetail } = useQuery({
    queryKey: ['review-detail', selectedReviewId],
    queryFn: () => reviewsApi.getById(selectedReviewId!),
    enabled: !!selectedReviewId,
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

  // レビュー詳細表示モード
  if (selectedReviewId) {
    return (
      <div className="space-y-4">
        {/* ヘッダー（戻るボタン） */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedReviewId(null)}
            className="flex items-center gap-1 text-sm text-foreground-muted hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            レビュー一覧に戻る
          </button>
        </div>

        {/* レビュー詳細 */}
        {isLoadingDetail ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
          </div>
        ) : reviewDetailData?.review ? (
          <ReviewDetailContent
            review={reviewDetailData.review}
            currentUserId={user?.id}
            onVerdictUpdated={() => {
              // 評価変更後にレビュー詳細とレビュー一覧を再取得
              queryClient.invalidateQueries({ queryKey: ['review-detail', selectedReviewId] });
              queryClient.invalidateQueries({ queryKey: ['test-suite-reviews', testSuiteId] });
            }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
            <p className="text-sm">レビューの読み込みに失敗しました</p>
          </div>
        )}
      </div>
    );
  }

  // レビュー一覧表示モード
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
