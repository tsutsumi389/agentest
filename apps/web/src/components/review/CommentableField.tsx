import { useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { useReviewSession, getCommentsForTarget } from '../../contexts/ReviewSessionContext';
import {
  ApiError,
  getTestSuiteComments,
  getTestCaseComments,
  type ReviewTargetType,
  type ReviewTargetField,
  type ReviewCommentWithReplies,
} from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../stores/toast';
import { ReviewCommentForm } from './ReviewCommentForm';
import { InlineCommentThread } from './InlineCommentThread';
import { ReviewCommentItem } from './ReviewCommentItem';

interface CommentableFieldProps {
  /** 子要素 */
  children: ReactNode;
  /** 対象タイプ（SUITE or CASE） */
  targetType: ReviewTargetType;
  /** 対象ID（テストスイートID or テストケースID） */
  targetId: string;
  /** 対象フィールド */
  targetField: ReviewTargetField;
  /** フィールド全体のコンテンツ（スナップショット用、オプション） */
  fieldContent?: string;
  /** 外部から渡されるコメント一覧（オプション） */
  comments?: ReviewCommentWithReplies[];
  /** 編集権限があるか */
  canEdit?: boolean;
  /** コメント追加時のコールバック */
  onCommentAdded?: () => void;
}

/**
 * フィールド全体にコメントを追加できるラッパーコンポーネント
 * 前提条件セクション全体や説明フィールド全体へのコメント追加に使用
 * targetItemIdなしでコメントを追加する
 */
export function CommentableField({
  children,
  targetType,
  targetId,
  targetField,
  fieldContent,
  comments: externalComments,
  canEdit: externalCanEdit,
  onCommentAdded,
}: CommentableFieldProps) {
  const queryClient = useQueryClient();
  const { isReviewing, currentReview, addComment, isLoading } = useReviewSession();
  const { user } = useAuth();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // APIから未解決コメントを取得（レビュー中でない場合のみ）
  const { data: unresolvedData, isLoading: isLoadingUnresolved } = useQuery({
    queryKey: ['unresolved-comments', targetType, targetId],
    queryFn: () => {
      const params = { status: 'OPEN' as const, limit: 100 };
      return targetType === 'SUITE'
        ? getTestSuiteComments(targetId, params)
        : getTestCaseComments(targetId, params);
    },
    enabled: !isReviewing && !!targetId,
  });

  // このフィールドに紐づくコメントを取得（targetItemIdがnullのもの）
  const allComments = externalComments || currentReview?.comments || [];
  const fieldComments = getCommentsForTarget(
    allComments,
    targetType,
    targetId,
    targetField,
    null // targetItemIdがnullのコメントのみ取得
  );
  const commentCount = fieldComments.length;

  // 未解決コメントをフィルタリング（レビュー中でない場合）
  const unresolvedComments = !isReviewing
    ? getCommentsForTarget(
        unresolvedData?.comments || [],
        targetType,
        targetId,
        targetField,
        null
      )
    : [];

  // 編集権限の判定（デフォルトはfalseで安全側に倒す）
  const canEdit = externalCanEdit ?? false;

  // コメント追加ハンドラ
  const handleAddComment = async (content: string) => {
    setIsSubmitting(true);
    try {
      await addComment({
        targetType,
        targetId,
        targetField,
        // targetItemIdは指定しない（フィールド全体へのコメント）
        targetItemContent: fieldContent,
        content,
      });
      setIsFormOpen(false);
      toast.success('コメントを追加しました');
      onCommentAdded?.();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('コメントの追加に失敗しました');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // コメント更新時のコールバック（キャッシュ無効化）
  const handleCommentUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['unresolved-comments', targetType, targetId] });
    onCommentAdded?.();
  };

  // レビューモードでない場合：未解決コメントがあれば表示
  if (!isReviewing) {
    // ローディング中またはコメントがない場合
    if (isLoadingUnresolved || unresolvedComments.length === 0) {
      return (
        <div>
          {children}
          {/* ローディング中の表示 */}
          {isLoadingUnresolved && (
            <div className="mt-2 flex items-center gap-2 text-foreground-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>コメントを読み込み中...</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div>
        {children}
        {/* 未解決コメント表示 */}
        <div className="mt-3 space-y-2">
          {unresolvedComments.map((comment) => (
            <ReviewCommentItem
              key={comment.id}
              comment={comment}
              targetType={targetType}
              targetId={targetId}
              currentUserId={user?.id || ''}
              canEdit={canEdit}
            />
          ))}
        </div>
      </div>
    );
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
        <div className="mt-3 p-3 bg-background-secondary rounded-lg border border-border">
          <ReviewCommentForm
            onSubmit={handleAddComment}
            isSubmitting={isSubmitting}
            placeholder="このセクションへのコメントを入力..."
            autoFocus
            onCancel={() => setIsFormOpen(false)}
            compact
          />
        </div>
      )}

      {/* インラインコメント表示 */}
      {commentCount > 0 && user && (
        <InlineCommentThread
          comments={fieldComments}
          currentUserId={user.id}
          canEdit={canEdit}
          onCommentUpdated={handleCommentUpdated}
        />
      )}
    </div>
  );
}
