import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Filter, Loader2, AlertCircle } from 'lucide-react';
import {
  reviewCommentsApi,
  getTestSuiteComments,
  getTestCaseComments,
  ApiError,
  type ReviewTargetType,
  type ReviewTargetField,
  type ReviewStatus,
  type ProjectMemberRole,
} from '../../lib/api';
import { toast } from '../../stores/toast';
import { ReviewCommentItem } from './ReviewCommentItem';
import { ReviewCommentForm } from './ReviewCommentForm';

/** ターゲットフィールドのオプション（共通） */
const COMMON_FIELD_OPTIONS: { value: ReviewTargetField; label: string }[] = [
  { value: 'TITLE', label: '全体' },
  { value: 'DESCRIPTION', label: '説明' },
];

/** テストスイート用のフィールドオプション */
const SUITE_FIELD_OPTIONS: { value: ReviewTargetField; label: string }[] = [
  ...COMMON_FIELD_OPTIONS,
  { value: 'PRECONDITION', label: '前提条件' },
];

/** テストケース用のフィールドオプション */
const CASE_FIELD_OPTIONS: { value: ReviewTargetField; label: string }[] = [
  ...COMMON_FIELD_OPTIONS,
  { value: 'PRECONDITION', label: '前提条件' },
  { value: 'STEP', label: 'ステップ' },
  { value: 'EXPECTED_RESULT', label: '期待結果' },
];

interface ReviewCommentListProps {
  /** ターゲットタイプ */
  targetType: ReviewTargetType;
  /** ターゲットID（テストスイートID or テストケースID） */
  targetId: string;
  /** 現在のユーザーID */
  currentUserId: string;
  /** 現在のユーザーのロール */
  currentRole?: 'OWNER' | ProjectMemberRole;
}

/**
 * レビューコメント一覧
 * フィルタリング、コメント作成、一覧表示
 */
export function ReviewCommentList({
  targetType,
  targetId,
  currentUserId,
  currentRole,
}: ReviewCommentListProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReviewStatus>('ALL');
  const [fieldFilter, setFieldFilter] = useState<ReviewTargetField | 'ALL'>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<ReviewTargetField>('TITLE');

  // 編集権限
  const canEdit = currentRole === 'OWNER' || currentRole === 'ADMIN' || currentRole === 'WRITE';

  // フィールドオプション
  const fieldOptions = targetType === 'SUITE' ? SUITE_FIELD_OPTIONS : CASE_FIELD_OPTIONS;

  // クエリキー
  const queryKey = ['review-comments', { targetType, targetId }];

  // コメント一覧取得
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => {
      const params = {
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        targetField: fieldFilter !== 'ALL' ? fieldFilter : undefined,
        limit: 100,
      };
      return targetType === 'SUITE'
        ? getTestSuiteComments(targetId, params)
        : getTestCaseComments(targetId, params);
    },
  });

  // コメント作成mutation
  const createMutation = useMutation({
    mutationFn: (content: string) =>
      reviewCommentsApi.create({
        targetType,
        targetId,
        targetField: selectedField,
        content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setIsFormOpen(false);
      toast.success('コメントを投稿しました');
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error('コメントの投稿に失敗しました');
      }
    },
  });

  const comments = data?.comments || [];
  const total = data?.total || 0;

  // 未解決コメント数
  const openCount = comments.filter((c) => c.status === 'OPEN').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-danger">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>コメントの取得に失敗しました</p>
        {error instanceof ApiError && <p className="text-sm">{error.message}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-foreground-muted" />
          <h3 className="font-semibold text-foreground">
            レビューコメント
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-foreground-muted">
                ({openCount} 件の未解決 / {total} 件)
              </span>
            )}
          </h3>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4" />
            コメント
          </button>
        )}
      </div>

      {/* フィルター */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-foreground-muted" />
          <span className="text-sm text-foreground-muted">フィルタ:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="input py-1 text-sm min-w-[120px]"
        >
          <option value="ALL">すべて</option>
          <option value="OPEN">未解決</option>
          <option value="RESOLVED">解決済み</option>
        </select>
        <select
          value={fieldFilter}
          onChange={(e) => setFieldFilter(e.target.value as typeof fieldFilter)}
          className="input py-1 text-sm min-w-[120px]"
        >
          <option value="ALL">全フィールド</option>
          {fieldOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* コメント作成フォーム */}
      {isFormOpen && (
        <div className="card p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              対象フィールド
            </label>
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value as ReviewTargetField)}
              className="input text-sm"
            >
              {fieldOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <ReviewCommentForm
            onSubmit={(content) => createMutation.mutate(content)}
            isSubmitting={createMutation.isPending}
            placeholder="コメントを入力..."
            onCancel={() => setIsFormOpen(false)}
            autoFocus
          />
        </div>
      )}

      {/* コメント一覧 */}
      {comments.length === 0 ? (
        <div className="card p-8 text-center text-foreground-muted">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>レビューコメントはまだありません</p>
          {canEdit && (
            <p className="text-sm mt-1">
              「コメント」ボタンからコメントを追加できます
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
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
      )}
    </div>
  );
}
