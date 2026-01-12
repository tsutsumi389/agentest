import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  getTestSuiteComments,
  getTestCaseComments,
  type ReviewTargetType,
} from '../../lib/api';
import { ReviewCommentItem } from './ReviewCommentItem';

interface UnresolvedCommentListProps {
  /** ターゲットタイプ */
  targetType: ReviewTargetType;
  /** テストスイートID または テストケースID */
  targetId: string;
  /** 現在のユーザーID */
  currentUserId: string;
  /** 編集権限（WRITE以上） */
  canEdit: boolean;
}

/**
 * 概要タブ用の未解決コメント一覧
 * - status='OPEN' でフィルタしたコメントを表示
 * - コメントがない場合は非表示
 */
export function UnresolvedCommentList({
  targetType,
  targetId,
  currentUserId,
  canEdit,
}: UnresolvedCommentListProps) {
  // 未解決コメント取得
  const { data, isLoading, error } = useQuery({
    queryKey: ['unresolved-comments', targetType, targetId],
    queryFn: () => {
      const params = { status: 'OPEN' as const, limit: 100 };
      return targetType === 'SUITE'
        ? getTestSuiteComments(targetId, params)
        : getTestCaseComments(targetId, params);
    },
    enabled: !!targetId,
  });

  const comments = data?.comments || [];

  // ローディング中
  if (isLoading) {
    return (
      <div className="card p-4 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
      </div>
    );
  }

  // エラー時
  if (error) {
    return (
      <div className="card p-4 text-danger text-sm">
        コメントの取得に失敗しました
      </div>
    );
  }

  // 未解決コメントがない場合は非表示
  if (comments.length === 0) {
    return null;
  }

  return (
    <div className="card">
      {/* ヘッダー */}
      <div className="p-4 border-b border-border flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-warning" />
        <h2 className="font-semibold text-foreground">未解決のコメント</h2>
        <span className="text-sm text-foreground-muted">
          ({comments.length}件)
        </span>
      </div>

      {/* コメント一覧 */}
      <div className="p-4 space-y-3">
        {comments.map((comment) => (
          <ReviewCommentItem
            key={comment.id}
            comment={comment}
            targetType={targetType}
            targetId={targetId}
            currentUserId={currentUserId}
            canEdit={canEdit}
          />
        ))}
      </div>
    </div>
  );
}
