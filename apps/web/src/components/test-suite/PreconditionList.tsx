import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { testSuitesApi, ApiError, type Precondition, type ReviewCommentWithReplies } from '../../lib/api';
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
  const [preconditions, setPreconditions] = useState<Precondition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 前提条件一覧を取得
  const fetchPreconditions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await testSuitesApi.getPreconditions(testSuiteId);
      // orderKeyでソート
      const sorted = response.preconditions.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
      setPreconditions(sorted);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('前提条件一覧の取得に失敗しました');
      }
    } finally {
      setIsLoading(false);
    }
  }, [testSuiteId]);

  useEffect(() => {
    fetchPreconditions();
  }, [fetchPreconditions]);

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
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchPreconditions}>
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
          <div className="p-4 text-center text-foreground-muted">
            前提条件が設定されていません
          </div>
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
