import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Reply,
  Pencil,
  Trash2,
  CheckCircle2,
  RotateCcw,
  MoreVertical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReviewCommentWithReplies, ReviewReply } from '../../lib/api';
import { useReviewSession } from '../../contexts/ReviewSessionContext';
import { toast } from '../../stores/toast';
import { ReviewStatusBadge } from './ReviewStatusBadge';
import { ReviewCommentForm } from './ReviewCommentForm';
import { ReviewCommentEditor } from './ReviewCommentEditor';
import { AuthorAvatar, AuthorName } from '../common/AuthorAvatar';

/** メニュー項目の型 */
interface MenuItem {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
}

interface InlineCommentThreadProps {
  /** コメント一覧 */
  comments: ReviewCommentWithReplies[];
  /** 現在のユーザーID */
  currentUserId: string;
  /** 編集権限があるか（WRITE以上） */
  canEdit: boolean;
  /** コメント更新時のコールバック */
  onCommentUpdated?: () => void;
}

/**
 * インラインコメントスレッド表示コンポーネント
 * GitHub PR風のコンパクトなコメント表示
 */
export function InlineCommentThread({
  comments,
  currentUserId,
  canEdit,
  onCommentUpdated,
}: InlineCommentThreadProps) {
  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {comments.map((comment) => (
        <InlineCommentItem
          key={comment.id}
          comment={comment}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onCommentUpdated={onCommentUpdated}
        />
      ))}
    </div>
  );
}

interface InlineCommentItemProps {
  comment: ReviewCommentWithReplies;
  currentUserId: string;
  canEdit: boolean;
  onCommentUpdated?: () => void;
}

/**
 * 個別のインラインコメント表示
 */
function InlineCommentItem({
  comment,
  currentUserId,
  canEdit,
  onCommentUpdated,
}: InlineCommentItemProps) {
  const {
    updateComment,
    deleteComment,
    updateCommentStatus,
    addReply,
    updateReply,
    deleteReply,
    isLoading,
  } = useReviewSession();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 投稿者かどうか
  const isAuthor = comment.authorUserId === currentUserId;

  // コメント編集ハンドラ
  const handleUpdate = async (content: string) => {
    setIsSubmitting(true);
    try {
      await updateComment(comment.id, content);
      setIsEditing(false);
      toast.success('コメントを更新しました');
      onCommentUpdated?.();
    } catch {
      toast.error('コメントの更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // コメント削除ハンドラ
  const handleDelete = async () => {
    if (!window.confirm('このコメントを削除しますか？返信もすべて削除されます。')) {
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteComment(comment.id);
      toast.success('コメントを削除しました');
      onCommentUpdated?.();
    } catch {
      toast.error('コメントの削除に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ステータス変更ハンドラ
  const handleStatusChange = async (status: 'OPEN' | 'RESOLVED') => {
    setIsSubmitting(true);
    try {
      await updateCommentStatus(comment.id, status);
      toast.success('ステータスを更新しました');
      onCommentUpdated?.();
    } catch {
      toast.error('ステータスの更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 返信作成ハンドラ
  const handleAddReply = async (content: string) => {
    setIsSubmitting(true);
    try {
      await addReply(comment.id, content);
      setIsReplying(false);
      setIsExpanded(true);
      toast.success('返信を投稿しました');
      onCommentUpdated?.();
    } catch {
      toast.error('返信の投稿に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 返信編集ハンドラ
  const handleUpdateReply = async (replyId: string, content: string) => {
    setIsSubmitting(true);
    try {
      await updateReply(comment.id, replyId, content);
      setEditingReplyId(null);
      toast.success('返信を更新しました');
      onCommentUpdated?.();
    } catch {
      toast.error('返信の更新に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 返信削除ハンドラ
  const handleDeleteReply = async (replyId: string) => {
    if (!window.confirm('この返信を削除しますか？')) {
      return;
    }
    setIsSubmitting(true);
    try {
      await deleteReply(comment.id, replyId);
      toast.success('返信を削除しました');
      onCommentUpdated?.();
    } catch {
      toast.error('返信の削除に失敗しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  // アクションメニュー項目
  const actionItems: MenuItem[] = [
    ...(isAuthor ? [
      {
        label: '編集',
        icon: Pencil,
        onClick: () => setIsEditing(true),
      },
      {
        label: '削除',
        icon: Trash2,
        onClick: handleDelete,
        danger: true,
      },
    ] : []),
    ...(canEdit ? [
      comment.status === 'OPEN'
        ? {
            label: '解決済みにする',
            icon: CheckCircle2,
            onClick: () => handleStatusChange('RESOLVED'),
          }
        : {
            label: '未解決に戻す',
            icon: RotateCcw,
            onClick: () => handleStatusChange('OPEN'),
          },
    ] : []),
  ];

  const hasReplies = comment.replies.length > 0;

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background">
      {/* ヘッダー */}
      <div className="flex items-center justify-between px-3 py-2 bg-background-secondary">
        <div className="flex items-center gap-2 min-w-0">
          <ReviewStatusBadge status={comment.status} showLabel={false} />
          <AuthorAvatar author={comment.author} agentSession={comment.agentSession} size="sm" />
          <AuthorName author={comment.author} agentSession={comment.agentSession} />
          <span className="text-xs text-foreground-muted">
            {new Date(comment.createdAt).toLocaleString('ja-JP')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <button
              type="button"
              onClick={() => setIsReplying(!isReplying)}
              disabled={isLoading || isSubmitting}
              className="p-1 text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
              title="返信"
            >
              <Reply className="w-4 h-4" />
            </button>
          )}
          {actionItems.length > 0 && (
            <MenuDropdown items={actionItems} disabled={isLoading || isSubmitting} />
          )}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="px-3 py-2">
        {isEditing ? (
          <ReviewCommentEditor
            initialContent={comment.content}
            onSave={handleUpdate}
            onCancel={() => setIsEditing(false)}
            isUpdating={isSubmitting}
          />
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {comment.content}
          </p>
        )}
      </div>

      {/* 返信フォーム */}
      {isReplying && (
        <div className="px-3 pb-3 border-t border-border pt-3">
          <ReviewCommentForm
            onSubmit={handleAddReply}
            isSubmitting={isSubmitting}
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
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-foreground-muted hover:text-foreground hover:bg-background-tertiary transition-colors"
          >
            <span>{comment.replies.length} 件の返信</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {isExpanded && (
            <div className="border-t border-border divide-y divide-border">
              {comment.replies.map((reply) => (
                <InlineReplyItem
                  key={reply.id}
                  reply={reply}
                  currentUserId={currentUserId}
                  isEditing={editingReplyId === reply.id}
                  onStartEdit={() => setEditingReplyId(reply.id)}
                  onCancelEdit={() => setEditingReplyId(null)}
                  onSave={(content) => handleUpdateReply(reply.id, content)}
                  onDelete={() => handleDeleteReply(reply.id)}
                  isSubmitting={isSubmitting}
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
 * メニュードロップダウン
 */
function MenuDropdown({ items, disabled }: { items: MenuItem[]; disabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 外部クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (items.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="p-1 text-foreground-muted hover:text-foreground transition-colors disabled:opacity-50"
        aria-label="操作メニュー"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-full mt-1 w-40 bg-background border border-border rounded-lg shadow-lg py-1 z-dropdown"
          role="menu"
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  item.danger
                    ? 'text-danger hover:bg-danger-subtle'
                    : 'text-foreground hover:bg-background-tertiary'
                }`}
                onClick={() => {
                  item.onClick();
                  setIsOpen(false);
                }}
                role="menuitem"
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * インライン返信アイテム
 */
interface InlineReplyItemProps {
  reply: ReviewReply;
  currentUserId: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (content: string) => void;
  onDelete: () => void;
  isSubmitting: boolean;
}

function InlineReplyItem({
  reply,
  currentUserId,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  isSubmitting,
}: InlineReplyItemProps) {
  const isAuthor = reply.authorUserId === currentUserId;

  const actionItems: MenuItem[] = isAuthor
    ? [
        { label: '編集', icon: Pencil, onClick: onStartEdit },
        { label: '削除', icon: Trash2, onClick: onDelete, danger: true },
      ]
    : [];

  return (
    <div className="px-3 py-2 bg-background-secondary/50">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AuthorAvatar author={reply.author} agentSession={reply.agentSession} size="sm" />
          <AuthorName author={reply.author} agentSession={reply.agentSession} />
          <span className="text-xs text-foreground-muted">
            {new Date(reply.createdAt).toLocaleString('ja-JP')}
          </span>
        </div>
        {actionItems.length > 0 && !isEditing && (
          <MenuDropdown items={actionItems} disabled={isSubmitting} />
        )}
      </div>

      <div className="mt-1 pl-7">
        {isEditing ? (
          <ReviewCommentEditor
            initialContent={reply.content}
            onSave={onSave}
            onCancel={onCancelEdit}
            isUpdating={isSubmitting}
          />
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">
            {reply.content}
          </p>
        )}
      </div>
    </div>
  );
}
