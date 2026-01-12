import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import {
  reviewsApi,
  type ReviewWithDetails,
  type ReviewCommentWithReplies,
} from '../../lib/api';
import { TARGET_FIELD_LABELS } from '../../lib/constants';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { AuthorAvatar, getAuthorDisplayName } from '../common/AuthorAvatar';

interface ReviewDetailModalProps {
  /** モーダルの表示状態 */
  isOpen: boolean;
  /** レビューID */
  reviewId: string | null;
  /** 閉じる際のコールバック */
  onClose: () => void;
}

/**
 * レビュー詳細モーダルコンポーネント
 * 提出済みレビューの詳細とコメント一覧を表示
 */
export function ReviewDetailModal({
  isOpen,
  reviewId,
  onClose,
}: ReviewDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // レビュー詳細を取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['review-detail', reviewId],
    queryFn: () => reviewsApi.getById(reviewId!),
    enabled: isOpen && !!reviewId,
  });

  const review = data?.review;

  // ESCキーでモーダルを閉じる + フォーカストラップ + 背景スクロール無効化
  useEffect(() => {
    if (!isOpen) return;

    // 背景スクロールを無効化
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    // フォーカスをモーダルに移動
    closeButtonRef.current?.focus();

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4">
      {/* オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* モーダル */}
      <div
        ref={modalRef}
        className="relative bg-background border border-border rounded-lg shadow-lg w-full max-w-2xl max-h-[80vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-detail-title"
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2
            id="review-detail-title"
            className="text-lg font-semibold text-foreground"
          >
            レビュー詳細
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-foreground-muted">
              <p className="text-sm">レビューの読み込みに失敗しました</p>
            </div>
          ) : review ? (
            <ReviewDetailContent review={review} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * レビュー詳細コンテンツ
 */
function ReviewDetailContent({ review }: { review: ReviewWithDetails }) {
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

/**
 * コメントカード
 */
function CommentCard({ comment }: { comment: ReviewCommentWithReplies }) {
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
