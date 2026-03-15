import { Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { testSuitesApi, type ReviewCommentWithReplies } from '../../lib/api';
import { MarkdownPreview } from '../common/markdown/MarkdownPreview';
import { CommentableField } from '../review/CommentableField';
import { CommentableItem } from '../review/CommentableItem';

interface PreconditionListProps {
  /** テストスイートID */
  testSuiteId: string;
  /** レビューコメント一覧 */
  comments?: ReviewCommentWithReplies[];
  /** 編集権限があるか */
  canEdit?: boolean;
  /** コメント追加時のコールバック */
  onCommentAdded?: () => void;
}

/**
 * 前提条件一覧コンポーネント（表示専用）
 * 編集はテストスイートの編集フォームから行う
 */
export function PreconditionList({
  testSuiteId,
  comments,
  canEdit,
  onCommentAdded,
}: PreconditionListProps) {
  // React Queryで前提条件一覧を取得
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['test-suite-preconditions', testSuiteId],
    queryFn: async () => {
      const response = await testSuitesApi.getPreconditions(testSuiteId);
      // 防御的にnullチェックしてorderKeyでソート
      const items = response?.preconditions ?? [];
      return items.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
    },
  });

  // キャッシュに古い形式のデータがある場合に備えて、配列であることを保証
  const preconditions = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">前提条件</h2>
        </div>
        <div className="flex items-center justify-center p-6">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">前提条件</h2>
        </div>
        <div className="text-center p-6">
          <p className="text-danger mb-4">
            {error instanceof Error ? error.message : '前提条件一覧の取得に失敗しました'}
          </p>
          <button className="btn btn-primary" onClick={() => refetch()}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <CommentableField
        targetType="SUITE"
        targetId={testSuiteId}
        targetField="PRECONDITION"
        comments={comments}
        canEdit={canEdit}
        onCommentAdded={onCommentAdded}
      >
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">前提条件</h2>
        </div>

        {preconditions.length === 0 ? (
          <div className="p-4 text-center text-foreground-muted">前提条件が設定されていません</div>
        ) : (
          <div className="p-4 space-y-2">
            {preconditions.map((precondition, index) => (
              <div
                key={precondition.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background-secondary"
              >
                {/* インデックス番号 */}
                <span className="w-6 h-6 rounded-full bg-background-tertiary text-foreground-muted text-xs font-medium flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>

                {/* 内容（CommentableItemでラップ） */}
                <CommentableItem
                  targetType="SUITE"
                  targetId={testSuiteId}
                  targetField="PRECONDITION"
                  itemId={precondition.id}
                  itemContent={precondition.content}
                  comments={comments}
                  canEdit={canEdit}
                  onCommentAdded={onCommentAdded}
                >
                  <MarkdownPreview content={precondition.content} className="text-sm" />
                </CommentableItem>
              </div>
            ))}
          </div>
        )}
      </CommentableField>
    </div>
  );
}
