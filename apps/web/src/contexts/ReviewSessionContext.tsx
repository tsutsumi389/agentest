import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  reviewsApi,
  type ReviewWithDetails,
  type ReviewCommentWithReplies,
  type ReviewReply,
  type ReviewVerdict,
  type ReviewTargetType,
  type ReviewTargetField,
  type ReviewStatus,
  type CreateReviewCommentRequest,
} from '../lib/api';

/**
 * レビューセッションコンテキストの値
 */
interface ReviewSessionContextValue {
  // 現在のレビューセッション（DRAFTレビュー）
  currentReview: ReviewWithDetails | null;
  // レビュー対象のテストスイートID
  testSuiteId: string | null;
  // レビューモード中かどうか
  isReviewing: boolean;
  // ローディング状態
  isLoading: boolean;
  // エラー
  error: string | null;

  // レビューを開始
  startReview: (testSuiteId: string, summary?: string) => Promise<void>;
  // レビューを提出
  submitReview: (verdict: ReviewVerdict, summary?: string) => Promise<void>;
  // レビューをキャンセル（削除）
  cancelReview: () => Promise<void>;
  // 既存の下書きレビューを読み込み
  loadDraftReview: (reviewId: string) => Promise<void>;

  // コメント操作
  addComment: (data: Omit<CreateReviewCommentRequest, 'reviewId'>) => Promise<ReviewCommentWithReplies>;
  updateComment: (commentId: string, content: string) => Promise<ReviewCommentWithReplies>;
  deleteComment: (commentId: string) => Promise<void>;
  updateCommentStatus: (commentId: string, status: ReviewStatus) => Promise<ReviewCommentWithReplies>;

  // 返信操作
  addReply: (commentId: string, content: string) => Promise<ReviewReply>;
  updateReply: (commentId: string, replyId: string, content: string) => Promise<ReviewReply>;
  deleteReply: (commentId: string, replyId: string) => Promise<void>;

  // レビューの再読み込み
  refreshReview: () => Promise<void>;
  // レビューセッションをクリア（コンポーネントアンマウント時）
  clearSession: () => void;
}

const ReviewSessionContext = createContext<ReviewSessionContextValue | null>(null);

/**
 * レビューセッションプロバイダー
 *
 * GitHub PR形式のレビューセッションを管理
 * - レビュー開始（DRAFT作成）
 * - コメント追加・編集
 * - レビュー提出（SUBMITTED）
 */
export function ReviewSessionProvider({ children }: { children: ReactNode }) {
  const [currentReview, setCurrentReview] = useState<ReviewWithDetails | null>(null);
  const [testSuiteId, setTestSuiteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReviewing = currentReview !== null;

  // レビューを開始
  const startReview = useCallback(async (suiteId: string, summary?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reviewsApi.start(suiteId, summary ? { summary } : undefined);
      setCurrentReview(response.review);
      setTestSuiteId(suiteId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'レビューの開始に失敗しました';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 既存の下書きレビューを読み込み
  const loadDraftReview = useCallback(async (reviewId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await reviewsApi.getById(reviewId);
      if (response.review.status !== 'DRAFT') {
        throw new Error('提出済みのレビューは編集できません');
      }
      setCurrentReview(response.review);
      setTestSuiteId(response.review.testSuiteId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'レビューの読み込みに失敗しました';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // レビューを提出
  const submitReview = useCallback(async (verdict: ReviewVerdict, summary?: string) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setIsLoading(true);
    setError(null);
    try {
      await reviewsApi.submit(currentReview.id, { verdict, summary });
      // 提出後はセッションをクリア
      setCurrentReview(null);
      setTestSuiteId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'レビューの提出に失敗しました';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentReview]);

  // レビューをキャンセル（削除）
  const cancelReview = useCallback(async () => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setIsLoading(true);
    setError(null);
    try {
      await reviewsApi.delete(currentReview.id);
      setCurrentReview(null);
      setTestSuiteId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'レビューのキャンセルに失敗しました';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentReview]);

  // コメント追加
  const addComment = useCallback(async (data: Omit<CreateReviewCommentRequest, 'reviewId'>) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setError(null);
    try {
      const response = await reviewsApi.addComment(currentReview.id, data as CreateReviewCommentRequest);
      // レビューを再取得してコメント一覧を更新
      const refreshed = await reviewsApi.getById(currentReview.id);
      setCurrentReview(refreshed.review);
      return response.comment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'コメントの追加に失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // コメント更新
  const updateComment = useCallback(async (commentId: string, content: string) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setError(null);
    try {
      const response = await reviewsApi.updateComment(currentReview.id, commentId, { content });
      // レビューを再取得してコメント一覧を更新
      const refreshed = await reviewsApi.getById(currentReview.id);
      setCurrentReview(refreshed.review);
      return response.comment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'コメントの更新に失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // コメント削除
  const deleteComment = useCallback(async (commentId: string) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setError(null);
    try {
      await reviewsApi.deleteComment(currentReview.id, commentId);
      // レビューを再取得してコメント一覧を更新
      const refreshed = await reviewsApi.getById(currentReview.id);
      setCurrentReview(refreshed.review);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'コメントの削除に失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // コメントステータス変更
  const updateCommentStatus = useCallback(async (commentId: string, status: ReviewStatus) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setError(null);
    try {
      const response = await reviewsApi.updateCommentStatus(currentReview.id, commentId, status);
      // レビューを再取得してコメント一覧を更新
      const refreshed = await reviewsApi.getById(currentReview.id);
      setCurrentReview(refreshed.review);
      return response.comment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'ステータスの更新に失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // 返信追加
  const addReply = useCallback(async (commentId: string, content: string) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setError(null);
    try {
      const response = await reviewsApi.addReply(currentReview.id, commentId, { content });
      // レビューを再取得してコメント一覧を更新
      const refreshed = await reviewsApi.getById(currentReview.id);
      setCurrentReview(refreshed.review);
      return response.reply;
    } catch (err) {
      const message = err instanceof Error ? err.message : '返信の追加に失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // 返信更新
  const updateReply = useCallback(async (commentId: string, replyId: string, content: string) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setError(null);
    try {
      const response = await reviewsApi.updateReply(currentReview.id, commentId, replyId, { content });
      // レビューを再取得してコメント一覧を更新
      const refreshed = await reviewsApi.getById(currentReview.id);
      setCurrentReview(refreshed.review);
      return response.reply;
    } catch (err) {
      const message = err instanceof Error ? err.message : '返信の更新に失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // 返信削除
  const deleteReply = useCallback(async (commentId: string, replyId: string) => {
    if (!currentReview) {
      throw new Error('レビューが開始されていません');
    }

    setError(null);
    try {
      await reviewsApi.deleteReply(currentReview.id, commentId, replyId);
      // レビューを再取得してコメント一覧を更新
      const refreshed = await reviewsApi.getById(currentReview.id);
      setCurrentReview(refreshed.review);
    } catch (err) {
      const message = err instanceof Error ? err.message : '返信の削除に失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // レビューの再読み込み
  const refreshReview = useCallback(async () => {
    if (!currentReview) return;

    setError(null);
    try {
      const response = await reviewsApi.getById(currentReview.id);
      setCurrentReview(response.review);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'レビューの再読み込みに失敗しました';
      setError(message);
      throw err;
    }
  }, [currentReview]);

  // セッションをクリア
  const clearSession = useCallback(() => {
    setCurrentReview(null);
    setTestSuiteId(null);
    setError(null);
  }, []);

  const value: ReviewSessionContextValue = {
    currentReview,
    testSuiteId,
    isReviewing,
    isLoading,
    error,
    startReview,
    submitReview,
    cancelReview,
    loadDraftReview,
    addComment,
    updateComment,
    deleteComment,
    updateCommentStatus,
    addReply,
    updateReply,
    deleteReply,
    refreshReview,
    clearSession,
  };

  return (
    <ReviewSessionContext.Provider value={value}>
      {children}
    </ReviewSessionContext.Provider>
  );
}

/**
 * レビューセッションコンテキストを使用するフック
 */
export function useReviewSession() {
  const context = useContext(ReviewSessionContext);
  if (!context) {
    throw new Error('useReviewSession must be used within a ReviewSessionProvider');
  }
  return context;
}

/**
 * 特定のターゲットに対するコメントを取得するヘルパー関数
 */
export function getCommentsForTarget(
  comments: ReviewCommentWithReplies[],
  targetType: ReviewTargetType,
  targetId: string,
  targetField?: ReviewTargetField,
  targetItemId?: string | null
): ReviewCommentWithReplies[] {
  return comments.filter((comment) => {
    if (comment.targetType !== targetType) return false;
    if (comment.targetId !== targetId) return false;
    if (targetField && comment.targetField !== targetField) return false;
    if (targetItemId !== undefined && comment.targetItemId !== targetItemId) return false;
    return true;
  });
}
