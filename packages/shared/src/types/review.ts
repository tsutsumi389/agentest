/**
 * レビューコメント関連の型定義
 */

import type { ReviewTargetType, ReviewTargetField, ReviewStatus } from './enums.js';

/**
 * レビューコメント基本型
 */
export interface ReviewComment {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  targetField: ReviewTargetField;
  targetItemId: string | null;
  authorUserId: string | null;
  authorAgentSessionId: string | null;
  content: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
}

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
 * コメント一覧レスポンス
 */
export interface ReviewCommentListResponse {
  comments: ReviewCommentWithReplies[];
  total: number;
  limit: number;
  offset: number;
}
