import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Pencil } from 'lucide-react';
import { type ReviewWithDetails, type ReviewCommentWithReplies } from '../../lib/api';
import { TARGET_FIELD_LABELS } from '../../lib/constants';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { ReviewVerdictEditModal } from './ReviewVerdictEditModal';
import { AuthorAvatar, getAuthorDisplayName } from '../common/AuthorAvatar';
import { MarkdownPreview } from '../common/markdown';

interface ReviewDetailContentProps {
  /** レビュー詳細データ */
  review: ReviewWithDetails;
  /** 現在のユーザーID（編集ボタン表示判定用） */
  currentUserId?: string;
  /** 評価変更後のコールバック */
  onVerdictUpdated?: () => void;
}

/**
 * レビュー詳細コンテンツ
 * レビューの著者情報、評価、サマリー、コメント一覧を表示
 * ReviewPanel（インライン表示）とReviewDetailModal（モーダル表示）の両方で使用
 */
export function ReviewDetailContent({
  review,
  currentUserId,
  onVerdictUpdated,
}: ReviewDetailContentProps) {
  const [isVerdictEditModalOpen, setIsVerdictEditModalOpen] = useState(false);
  const authorName = getAuthorDisplayName(review.author, review.agentSession);

  // 投稿者本人かつSUBMITTED状態の場合のみ編集可能
  const canEditVerdict =
    currentUserId && review.author?.id === currentUserId && review.status === 'SUBMITTED';

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
          <AuthorAvatar author={review.author} agentSession={review.agentSession} size="lg" />
          <div>
            <div className="font-medium text-foreground">{authorName}</div>
            <div className="text-xs text-foreground-muted">{submittedAt}</div>
          </div>
        </div>

        {/* 評価バッジ */}
        {review.verdict && (
          <div className="flex items-center gap-2">
            <ReviewVerdictBadge verdict={review.verdict} />
            {canEditVerdict && (
              <button
                type="button"
                onClick={() => setIsVerdictEditModalOpen(true)}
                className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
                title="評価を変更"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* サマリー */}
        {review.summary && (
          <div className="p-3 bg-background-secondary rounded-lg text-sm">
            <MarkdownPreview content={review.summary} />
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
          <p className="text-sm text-foreground-muted py-4 text-center">コメントはありません</p>
        ) : (
          <div className="space-y-3">
            {review.comments.map((comment) => (
              <CommentCard key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </div>

      {/* 評価変更モーダル */}
      {review.verdict && (
        <ReviewVerdictEditModal
          isOpen={isVerdictEditModalOpen}
          onClose={() => setIsVerdictEditModalOpen(false)}
          reviewId={review.id}
          currentVerdict={review.verdict}
          onSuccess={() => onVerdictUpdated?.()}
        />
      )}
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
        <div className="flex items-center gap-2 min-w-0">
          <ReviewStatusBadge status={comment.status} showLabel={false} />
          <span className="text-xs text-foreground-muted truncate">
            {TARGET_FIELD_LABELS[comment.targetField]}
            {comment.targetType === 'CASE' && comment.targetName && <> - {comment.targetName}</>}
          </span>
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-3">
        {/* 著者情報 */}
        <div className="flex items-center gap-2 mb-2">
          <AuthorAvatar author={comment.author} agentSession={comment.agentSession} size="sm" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{authorName}</span>
            <span className="text-xs text-foreground-muted ml-2">
              {new Date(comment.createdAt).toLocaleString('ja-JP')}
            </span>
          </div>
        </div>

        {/* 対象アイテムの原文スナップショット */}
        {comment.targetItemContent && (
          <div className="mb-3 p-2 bg-background-tertiary rounded border-l-2 border-accent">
            <MarkdownPreview content={comment.targetItemContent} />
          </div>
        )}

        {/* コメント内容 */}
        <div className="text-sm">
          <MarkdownPreview content={comment.content} />
        </div>
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
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                  <div className="text-sm pl-7">
                    <MarkdownPreview content={reply.content} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
