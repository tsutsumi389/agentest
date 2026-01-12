/**
 * レビュー関連の型定義
 */

import type {
  ReviewTargetType,
  ReviewTargetField,
  ReviewStatus,
  ReviewSessionStatus,
  ReviewVerdict,
} from './enums.js';

/**
 * 著者情報
 */
export interface ReviewAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * エージェントセッション情報
 */
export interface ReviewAgentSession {
  id: string;
  clientName: string | null;
}

/**
 * レビューセッション基本型
 */
export interface Review {
  id: string;
  testSuiteId: string;
  authorUserId: string | null;
  authorAgentSessionId: string | null;
  status: ReviewSessionStatus;
  verdict: ReviewVerdict | null;
  summary: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * レビューコメント基本型
 */
export interface ReviewComment {
  id: string;
  reviewId: string;
  targetType: ReviewTargetType;
  targetId: string;
  targetField: ReviewTargetField;
  targetItemId: string | null;
  targetItemContent: string | null;
  authorUserId: string | null;
  authorAgentSessionId: string | null;
  content: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * レビュー返信
 */
export interface ReviewReply {
  id: string;
  commentId: string;
  authorUserId: string | null;
  authorAgentSessionId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: ReviewAuthor | null;
  agentSession: ReviewAgentSession | null;
}

/**
 * 返信を含むレビューコメント
 */
export interface ReviewCommentWithReplies extends ReviewComment {
  author: ReviewAuthor | null;
  agentSession: ReviewAgentSession | null;
  replies: ReviewReply[];
  _count: { replies: number };
}

/**
 * 著者情報付きレビュー（一覧用）
 */
export interface ReviewWithAuthor extends Review {
  author: ReviewAuthor | null;
  agentSession: ReviewAgentSession | null;
  _count: { comments: number };
}

/**
 * 詳細付きレビュー（コメント含む）
 */
export interface ReviewWithDetails extends ReviewWithAuthor {
  comments: ReviewCommentWithReplies[];
}

/**
 * 下書きレビュー（テストスイート情報付き）
 */
export interface DraftReview extends ReviewWithAuthor {
  testSuite: {
    id: string;
    name: string;
    project: {
      id: string;
      name: string;
    };
  };
}

/**
 * コメント一覧レスポンス
 */
export interface ReviewCommentListResponse {
  comments: ReviewCommentWithReplies[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * レビュー一覧レスポンス
 */
export interface ReviewListResponse {
  reviews: ReviewWithAuthor[];
  total: number;
  limit: number;
  offset: number;
}
