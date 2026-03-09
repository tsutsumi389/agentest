import { api } from './client.js';
import type {
  ReviewCommentSearchParams,
  ReviewSearchParams,
  CreateReviewCommentRequest,
} from './types.js';
import type {
  ReviewCommentWithReplies,
  ReviewReply,
  ReviewCommentListResponse,
  ReviewListResponse,
  ReviewWithDetails,
  DraftReview,
  ReviewVerdict,
  ReviewStatus,
} from '@agentest/shared';

// ============================================
// レビューコメントAPI
// ============================================
/**
 * @deprecated 非推奨: 新しいレビューセッションベースのAPIを使用してください
 * reviewsApi.addComment(), reviewsApi.updateComment()等を使用してください
 */
export const reviewCommentsApi = {
  // コメント作成
  create: (data: CreateReviewCommentRequest) =>
    api.post<{ comment: ReviewCommentWithReplies }>('/api/review-comments', data),

  // コメント詳細取得
  getById: (commentId: string) =>
    api.get<{ comment: ReviewCommentWithReplies }>(`/api/review-comments/${commentId}`),

  // コメント編集
  update: (commentId: string, data: { content: string }) =>
    api.patch<{ comment: ReviewCommentWithReplies }>(`/api/review-comments/${commentId}`, data),

  // コメント削除
  delete: (commentId: string) =>
    api.delete<void>(`/api/review-comments/${commentId}`),

  // ステータス変更
  updateStatus: (commentId: string, status: ReviewStatus) =>
    api.patch<{ comment: ReviewCommentWithReplies }>(`/api/review-comments/${commentId}/status`, { status }),

  // 返信作成
  createReply: (commentId: string, data: { content: string }) =>
    api.post<{ reply: ReviewReply }>(`/api/review-comments/${commentId}/replies`, data),

  // 返信編集
  updateReply: (commentId: string, replyId: string, data: { content: string }) =>
    api.patch<{ reply: ReviewReply }>(`/api/review-comments/${commentId}/replies/${replyId}`, data),

  // 返信削除
  deleteReply: (commentId: string, replyId: string) =>
    api.delete<void>(`/api/review-comments/${commentId}/replies/${replyId}`),
};

// testSuitesApiにコメント一覧取得を追加するヘルパー関数
export const getTestSuiteComments = (testSuiteId: string, params?: ReviewCommentSearchParams) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.targetField) query.set('targetField', params.targetField);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  const queryString = query.toString();
  return api.get<ReviewCommentListResponse>(
    `/api/test-suites/${testSuiteId}/comments${queryString ? `?${queryString}` : ''}`
  );
};

// testCasesApiにコメント一覧取得を追加するヘルパー関数
export const getTestCaseComments = (testCaseId: string, params?: ReviewCommentSearchParams) => {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.targetField) query.set('targetField', params.targetField);
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  const queryString = query.toString();
  return api.get<ReviewCommentListResponse>(
    `/api/test-cases/${testCaseId}/comments${queryString ? `?${queryString}` : ''}`
  );
};

// ============================================
// レビューAPI（GitHub PR形式）
// ============================================

export const reviewsApi = {
  // テストスイートのレビュー一覧取得（SUBMITTEDのみ）
  getByTestSuite: (testSuiteId: string, params?: ReviewSearchParams) => {
    const query = new URLSearchParams();
    if (params?.verdict) query.set('verdict', params.verdict);
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    const queryString = query.toString();
    return api.get<ReviewListResponse>(
      `/api/test-suites/${testSuiteId}/reviews${queryString ? `?${queryString}` : ''}`
    );
  },

  // レビュー開始（DRAFT作成）
  start: (testSuiteId: string, data?: { summary?: string }) =>
    api.post<{ review: ReviewWithDetails }>(`/api/test-suites/${testSuiteId}/reviews`, data),

  // 自分の下書きレビュー一覧取得
  getDrafts: () =>
    api.get<{ reviews: DraftReview[] }>('/api/reviews/drafts'),

  // レビュー詳細取得
  getById: (reviewId: string) =>
    api.get<{ review: ReviewWithDetails }>(`/api/reviews/${reviewId}`),

  // レビュー更新（DRAFTのみ）
  update: (reviewId: string, data: { summary?: string }) =>
    api.patch<{ review: ReviewWithDetails }>(`/api/reviews/${reviewId}`, data),

  // レビュー提出（DRAFT → SUBMITTED）
  submit: (reviewId: string, data: { verdict: ReviewVerdict; summary?: string }) =>
    api.post<{ review: ReviewWithDetails }>(`/api/reviews/${reviewId}/submit`, data),

  // 提出済みレビューの評価変更
  updateVerdict: (reviewId: string, verdict: ReviewVerdict) =>
    api.patch<{ review: ReviewWithDetails }>(`/api/reviews/${reviewId}/verdict`, { verdict }),

  // レビュー削除（DRAFTのみ）
  delete: (reviewId: string) =>
    api.delete<void>(`/api/reviews/${reviewId}`),

  // コメント追加
  addComment: (reviewId: string, data: CreateReviewCommentRequest) =>
    api.post<{ comment: ReviewCommentWithReplies }>(`/api/reviews/${reviewId}/comments`, data),

  // コメント更新
  updateComment: (reviewId: string, commentId: string, data: { content: string }) =>
    api.patch<{ comment: ReviewCommentWithReplies }>(`/api/reviews/${reviewId}/comments/${commentId}`, data),

  // コメント削除
  deleteComment: (reviewId: string, commentId: string) =>
    api.delete<void>(`/api/reviews/${reviewId}/comments/${commentId}`),

  // コメントステータス変更
  updateCommentStatus: (reviewId: string, commentId: string, status: ReviewStatus) =>
    api.patch<{ comment: ReviewCommentWithReplies }>(`/api/reviews/${reviewId}/comments/${commentId}/status`, { status }),

  // 返信追加
  addReply: (reviewId: string, commentId: string, data: { content: string }) =>
    api.post<{ reply: ReviewReply }>(`/api/reviews/${reviewId}/comments/${commentId}/replies`, data),

  // 返信更新
  updateReply: (reviewId: string, commentId: string, replyId: string, data: { content: string }) =>
    api.patch<{ reply: ReviewReply }>(`/api/reviews/${reviewId}/comments/${commentId}/replies/${replyId}`, data),

  // 返信削除
  deleteReply: (reviewId: string, commentId: string, replyId: string) =>
    api.delete<void>(`/api/reviews/${reviewId}/comments/${commentId}/replies/${replyId}`),
};
