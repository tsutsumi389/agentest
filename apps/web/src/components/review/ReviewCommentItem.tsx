import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronUp,
  Reply,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import {
  reviewCommentsApi,
  ApiError,
  type ReviewCommentWithReplies,
  type ReviewReply,
  type ReviewStatus,
  type ReviewTargetType,
} from '../../lib/api';
import { TARGET_FIELD_LABELS } from '../../lib/constants';
import { toast } from '../../stores/toast';
import { MarkdownPreview } from '../common/markdown';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { ReviewCommentForm } from './ReviewCommentForm';
import { ReviewCommentEditor } from './ReviewCommentEditor';
import { AuthorAvatar, AuthorName } from '../common/AuthorAvatar';

interface ReviewCommentItemProps {
  /** コメントデータ */
  comment: ReviewCommentWithReplies;
  /** ターゲットタイプ */
  targetType: ReviewTargetType;
  /** ターゲットID */
  targetId: string;
  /** 現在のユーザーID */
  currentUserId: string;
  /** 編集権限があるか（WRITE以上） */
  canEdit: boolean;
}

/**
 * レビューコメントアイテム
 * コメント表示、返信リスト、アコーディオン機能
 */
export function ReviewCommentItem({
  comment,
  targetType,
  targetId,
  currentUserId,
  canEdit,
}: ReviewCommentItemProps) {
  const queryClient = useQueryClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);

  const queryKey = ['review-comments', { targetType, targetId }];

  // 投稿者かどうか
  const isAuthor = comment.authorUserId === currentUserId;

  // コメント編集mutation
  const updateMutation = useMutation({
    mutationFn: (content: string) => reviewCommentsApi.update(comment.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setIsEditing(false);
      toast.success('コメントを更新しました');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('コメントの更新に失敗しました');
      }
    },
  });

  // コメント削除mutation
  const deleteMutation = useMutation({
    mutationFn: () => reviewCommentsApi.delete(comment.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('コメントを削除しました');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('コメントの削除に失敗しました');
      }
    },
  });

  // ステータス変更mutation
  const updateStatusMutation = useMutation({
    mutationFn: (status: ReviewStatus) => reviewCommentsApi.updateStatus(comment.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // 未解決コメント一覧のキャッシュも更新
      queryClient.invalidateQueries({ queryKey: ['unresolved-comments', targetType, targetId] });
      toast.success('ステータスを更新しました');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('ステータスの更新に失敗しました');
      }
    },
  });

  // 返信作成mutation
  const createReplyMutation = useMutation({
    mutationFn: (content: string) => reviewCommentsApi.createReply(comment.id, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setIsReplying(false);
      setIsExpanded(true);
      toast.success('返信を投稿しました');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('返信の投稿に失敗しました');
      }
    },
  });

  // 返信編集mutation
  const updateReplyMutation = useMutation({
    mutationFn: ({ replyId, content }: { replyId: string; content: string }) =>
      reviewCommentsApi.updateReply(comment.id, replyId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingReplyId(null);
      toast.success('返信を更新しました');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('返信の更新に失敗しました');
      }
    },
  });

  // 返信削除mutation
  const deleteReplyMutation = useMutation({
    mutationFn: (replyId: string) => reviewCommentsApi.deleteReply(comment.id, replyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('返信を削除しました');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('返信の削除に失敗しました');
      }
    },
  });

  // 削除確認ハンドラ
  const handleDelete = () => {
    if (window.confirm('このコメントを削除しますか？返信もすべて削除されます。')) {
      deleteMutation.mutate();
    }
  };

  // 処理中状態
  const isSubmitting =
    updateMutation.isPending ||
    deleteMutation.isPending ||
    updateStatusMutation.isPending ||
    createReplyMutation.isPending ||
    updateReplyMutation.isPending ||
    deleteReplyMutation.isPending;

  const hasReplies = comment.replies.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 bg-background-secondary">
        <div className="flex items-center gap-2 min-w-0">
          <ReviewStatusBadge status={comment.status} showLabel={false} />
          <span className="text-xs text-foreground-muted truncate">
            {TARGET_FIELD_LABELS[comment.targetField]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* 返信ボタン */}
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsReplying(!isReplying)}
              disabled={isSubmitting}
              className="p-1 text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="返信"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
          {/* 編集ボタン（投稿者のみ） */}
          {isAuthor && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isSubmitting}
              className="p-1 text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="編集"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {/* 削除ボタン（投稿者のみ） */}
          {isAuthor && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="p-1 text-foreground-muted hover:text-danger transition-colors disabled:opacity-50"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {/* 解決済み/未解決ボタン（編集権限のみ） */}
          {canEdit && (
            comment.status === 'OPEN' ? (
              <button
                type="button"
                onClick={() => updateStatusMutation.mutate('RESOLVED')}
                disabled={isSubmitting}
                className="p-1 text-foreground-muted hover:text-success transition-colors disabled:opacity-50"
                title="解決済みにする"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => updateStatusMutation.mutate('OPEN')}
                disabled={isSubmitting}
                className="p-1 text-foreground-muted hover:text-warning transition-colors disabled:opacity-50"
                title="未解決に戻す"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="p-3">
        {/* 著者情報 */}
        <div className="flex items-center gap-2 mb-2">
          <AuthorAvatar author={comment.author} agentSession={comment.agentSession} />
          <div className="min-w-0">
            <AuthorName author={comment.author} agentSession={comment.agentSession} />
            <span className="text-xs text-foreground-muted">
              {new Date(comment.createdAt).toLocaleString('ja-JP')}
            </span>
          </div>
        </div>

        {/* 対象アイテムのスナップショット表示 */}
        {comment.targetItemContent && (
          <div className="mb-3 p-2 bg-background-tertiary rounded border-l-2 border-accent">
            <MarkdownPreview content={comment.targetItemContent} />
          </div>
        )}

        {/* コメント内容 */}
        {isEditing ? (
          <ReviewCommentEditor
            initialContent={comment.content}
            onSave={(content) => updateMutation.mutate(content)}
            onCancel={() => setIsEditing(false)}
            isUpdating={updateMutation.isPending}
          />
        ) : (
          <div className="text-sm">
            <MarkdownPreview content={comment.content} />
          </div>
        )}
      </div>

      {/* 返信フォーム */}
      {isReplying && (
        <div className="px-3 pb-3 border-t border-border pt-3">
          <ReviewCommentForm
            onSubmit={(content) => createReplyMutation.mutate(content)}
            isSubmitting={createReplyMutation.isPending}
            placeholder="返信を入力..."
            autoFocus
            onCancel={() => setIsReplying(false)}
            compact
          />
        </div>
      )}

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
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  currentUserId={currentUserId}
                  isEditing={editingReplyId === reply.id}
                  onStartEdit={() => setEditingReplyId(reply.id)}
                  onCancelEdit={() => setEditingReplyId(null)}
                  onSave={(content) => updateReplyMutation.mutate({ replyId: reply.id, content })}
                  onDelete={() => {
                    if (window.confirm('この返信を削除しますか？')) {
                      deleteReplyMutation.mutate(reply.id);
                    }
                  }}
                  isUpdating={updateReplyMutation.isPending}
                  isDeleting={deleteReplyMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * 返信アイテム
 */
interface ReplyItemProps {
  reply: ReviewReply;
  currentUserId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (content: string) => void;
  onDelete: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}

function ReplyItem({
  reply,
  currentUserId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  isUpdating,
  isDeleting,
}: ReplyItemProps) {
  const isAuthor = reply.authorUserId === currentUserId;

  return (
    <div className="p-3 bg-background-secondary/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AuthorAvatar author={reply.author} agentSession={reply.agentSession} size="sm" />
          <div className="min-w-0">
            <AuthorName author={reply.author} agentSession={reply.agentSession} />
            <span className="text-xs text-foreground-muted">
              {new Date(reply.createdAt).toLocaleString('ja-JP')}
            </span>
          </div>
        </div>
        {isAuthor && !isEditing && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onStartEdit}
              disabled={isUpdating || isDeleting}
              className="p-1 text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="編集"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isUpdating || isDeleting}
              className="p-1 text-foreground-muted hover:text-danger transition-colors disabled:opacity-50"
              title="削除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-2 pl-8">
        {isEditing ? (
          <ReviewCommentEditor
            initialContent={reply.content}
            onSave={onSave}
            onCancel={onCancelEdit}
            isUpdating={isUpdating}
          />
        ) : (
          <div className="text-sm">
            <MarkdownPreview content={reply.content} />
          </div>
        )}
      </div>
    </div>
  );
}
