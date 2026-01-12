import { useState, type ReactNode } from 'react';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { useReviewSession, getCommentsForTarget } from '../../contexts/ReviewSessionContext';
import type { ReviewTargetType, ReviewTargetField, ReviewCommentWithReplies } from '../../lib/api';
import { toast } from '../../stores/toast';
import { ReviewCommentForm } from './ReviewCommentForm';

interface CommentableItemProps {
  /** 子要素 */
  children: ReactNode;
  /** 対象タイプ（SUITE or CASE） */
  targetType: ReviewTargetType;
  /** 対象ID（テストスイートID or テストケースID） */
  targetId: string;
  /** 対象フィールド */
  targetField: ReviewTargetField;
  /** アイテムID（前提条件/ステップ/期待結果のID） */
  itemId: string;
  /** アイテムの内容（スナップショット用） */
  itemContent: string;
  /** 外部から渡されるコメント一覧（オプション） */
  comments?: ReviewCommentWithReplies[];
  /** コメント追加時のコールバック */
  onCommentAdded?: () => void;
}

/**
 * コメント可能なアイテムのラッパーコンポーネント
 * レビューモード中にホバーするとコメント追加ボタンを表示し、
 * クリックでインラインフォームを展開する
 */
export function CommentableItem({
  children,
  targetType,
  targetId,
  targetField,
  itemId,
  itemContent,
  comments: externalComments,
  onCommentAdded,
}: CommentableItemProps) {
  const { isReviewing, currentReview, addComment, isLoading } = useReviewSession();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // このアイテムに紐づくコメントを取得
  const allComments = externalComments || currentReview?.comments || [];
  const itemComments = getCommentsForTarget(
    allComments,
    targetType,
    targetId,
    targetField,
    itemId
  );
  const commentCount = itemComments.length;

  // コメント追加ハンドラ
  const handleAddComment = async (content: string) => {
    setIsSubmitting(true);
    try {
      await addComment({
        targetType,
        targetId,
        targetField,
        targetItemId: itemId,
        targetItemContent: itemContent,
        content,
      });
      setIsFormOpen(false);
      toast.success('コメントを追加しました');
      onCommentAdded?.();
    } catch (err) {
      // エラーはコンテキストで処理される
      console.error('コメントの追加に失敗しました', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // レビューモードでない場合は子要素のみを表示
  if (!isReviewing) {
    return <>{children}</>;
  }

  return (
    <div className="group relative">
      {/* メインコンテンツ */}
      <div className="flex items-start">
        {/* 子要素 */}
        <div className="flex-1 min-w-0">{children}</div>

        {/* コメント追加ボタン */}
        <div className="flex-shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            disabled={isLoading}
            className="relative p-1.5 text-foreground-muted hover:text-accent hover:bg-accent/10 rounded transition-colors"
            title="コメントを追加"
            aria-label="コメントを追加"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageSquarePlus className="w-4 h-4" />
            )}
            {/* コメント数バッジ */}
            {commentCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-xs font-medium bg-accent text-white rounded-full flex items-center justify-center">
                {commentCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* インラインフォーム */}
      {isFormOpen && (
        <div className="mt-3 ml-9 p-3 bg-background-secondary rounded-lg border border-border">
          <ReviewCommentForm
            onSubmit={handleAddComment}
            isSubmitting={isSubmitting}
            placeholder="このアイテムへのコメントを入力..."
            autoFocus
            onCancel={() => setIsFormOpen(false)}
            compact
          />
        </div>
      )}
    </div>
  );
}
