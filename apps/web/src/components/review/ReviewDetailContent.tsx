import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import {
  type ReviewWithDetails,
  type ReviewCommentWithReplies,
} from '../../lib/api';
import { TARGET_FIELD_LABELS } from '../../lib/constants';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { AuthorAvatar, getAuthorDisplayName } from '../common/AuthorAvatar';

interface ReviewDetailContentProps {
  /** レビュー詳細データ */
  review: ReviewWithDetails;
}

/**
 * レビュー詳細コンテンツ
 * レビューの著者情報、評価、サマリー、コメント一覧を表示
 * ReviewPanel（インライン表示）とReviewDetailModal（モーダル表示）の両方で使用
 */
export function ReviewDetailContent({ review }: ReviewDetailContentProps) {
  const authorName = getAuthorDisplayName(review.author, review.agentSession);

  const submittedAt = review.submittedAt
    ? new Date(review.submittedAt).toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div className="space-y-6">
      {/* レビュー情報 */}
      <div className="space-y-4">
        {/* 著者と日時 */}
        <div className="flex items-center gap-3">
          <AuthorAvatar
            author={review.author}
            agentSession={review.agentSession}
            size="lg"
          />
          <div>
            <div className="font-medium text-foreground">{authorName}</div>
            <div className="text-xs text-foreground-muted">{submittedAt}</div>
          </div>
        </div>

        {/* 評価バッジ */}
        {review.verdict && (
          <div>
            <ReviewVerdictBadge verdict={review.verdict} />
          </div>
        )}

        {/* サマリー */}
        {review.summary && (
          <div className="p-3 bg-background-secondary rounded-lg">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {review.summary}
            </p>
          </div>
        )}
      </div>

      {/* コメント一覧 */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          コメント ({review.comments.length}件)
        </h3>

        {review.comments.length === 0 ? (
          <p className="text-sm text-foreground-muted py-4 text-center">
            コメントはありません
          </p>
        ) : (
          <div className="space-y-3">
            {review.comments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CommentCardProps {
  /** コメントデータ */
  comment: ReviewCommentWithReplies;
}

/**
 * コメントカード
 * コメントの著者情報、内容、返信一覧を表示
 */
export function CommentCard({ comment }: CommentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasReplies = comment.replies.length > 0;

  const authorName = getAuthorDisplayName(comment.author, comment.agentSession);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 bg-background-secondary">
        <div className="flex items-center gap-2">
          <ReviewStatusBadge status={comment.status} showLabel={false} />
          <span className="text-xs text-foreground-muted">
            {TARGET_FIELD_LABELS[comment.targetField]}
          </span>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-3">
        {/* 著者情報 */}
        <div className="flex items-center gap-2 mb-2">
          <AuthorAvatar
            author={comment.author}
            agentSession={comment.agentSession}
            size="sm"
          />
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">
              {authorName}
            </span>
            <span className="text-xs text-foreground-muted ml-2">
              {new Date(comment.createdAt).toLocaleString('ja-JP')}
            </span>
          </div>
        </div>

        {/* コメント内容 */}
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
          {comment.content}
        </p>
      </div>

      {/* 返信セクション */}
      {hasReplies && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
          >
            <span>{comment.replies.length} 件の返信</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {isExpanded && (
            <div className="border-t border-border divide-y divide-border">
              {comment.replies.map((reply) => (
                <div key={reply.id} className="p-3 bg-background-secondary/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AuthorAvatar
                      author={reply.author}
                      agentSession={reply.agentSession}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {getAuthorDisplayName(reply.author, reply.agentSession)}
                      </span>
                      <span className="text-xs text-foreground-muted ml-2">
                        {new Date(reply.createdAt).toLocaleString('ja-JP')}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words pl-7">
                    {reply.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
