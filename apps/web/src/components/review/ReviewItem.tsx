import { MessageSquare, ChevronRight, Bot } from 'lucide-react';
import type { ReviewWithAuthor } from '../../lib/api';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';

interface ReviewItemProps {
  /** レビューデータ */
  review: ReviewWithAuthor;
  /** クリック時のコールバック */
  onClick: () => void;
}

/**
 * レビューアイテムコンポーネント
 * 提出済みレビューを一覧表示するためのカード
 */
export function ReviewItem({ review, onClick }: ReviewItemProps) {
  const authorName = review.agentSession
    ? review.agentSession.clientName || 'Agent'
    : review.author?.name || '不明なユーザー';

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
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 border border-border rounded-lg hover:bg-background-secondary transition-colors group"
    >
      <div className="flex items-start justify-between gap-3">
        {/* 左側: 著者情報と評価 */}
        <div className="flex-1 min-w-0">
          {/* 著者行 */}
          <div className="flex items-center gap-2 mb-2">
            <AuthorAvatar
              author={review.author}
              agentSession={review.agentSession}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground text-sm truncate">
                  {authorName}
                </span>
                <span className="text-xs text-foreground-muted">
                  {submittedAt}
                </span>
              </div>
            </div>
          </div>

          {/* 評価バッジ */}
          {review.verdict && (
            <div className="mb-2">
              <ReviewVerdictBadge verdict={review.verdict} />
            </div>
          )}

          {/* サマリー */}
          {review.summary && (
            <p className="text-sm text-foreground-muted line-clamp-2 mb-2">
              {review.summary}
            </p>
          )}

          {/* コメント数 */}
          <div className="flex items-center gap-1 text-xs text-foreground-muted">
            <MessageSquare className="w-3 h-3" />
            <span>{review._count.comments}件のコメント</span>
          </div>
        </div>

        {/* 右側: 詳細ボタン */}
        <div className="flex-shrink-0 text-foreground-muted group-hover:text-foreground transition-colors">
          <ChevronRight className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
}

/**
 * 著者アバター
 */
function AuthorAvatar({
  author,
  agentSession,
}: {
  author: { name: string; avatarUrl: string | null } | null;
  agentSession: { clientName: string | null } | null;
}) {
  if (agentSession) {
    return (
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-accent" />
      </div>
    );
  }

  if (author?.avatarUrl) {
    return (
      <img
        src={author.avatarUrl}
        alt={author.name}
        className="w-8 h-8 rounded-full flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-8 h-8 rounded-full bg-foreground-muted/20 flex items-center justify-center flex-shrink-0 text-sm font-medium text-foreground-muted">
      {author?.name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}
