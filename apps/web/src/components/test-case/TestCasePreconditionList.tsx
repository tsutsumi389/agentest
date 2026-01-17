import { useState, useEffect } from 'react';
import {
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCasePrecondition, type ReviewCommentWithReplies } from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';
import { CommentableItem } from '../review/CommentableItem';
import { CommentableField } from '../review/CommentableField';

interface TestCasePreconditionListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialPreconditions?: TestCasePrecondition[];
  /** レビューコメント一覧 */
  comments?: ReviewCommentWithReplies[];
  /** 編集権限があるか */
  canEdit?: boolean;
  /** コメント追加時のコールバック */
  onCommentAdded?: () => void;
}

/**
 * テストケース前提条件一覧コンポーネント（表示のみ）
 * 編集は編集モードのTestCaseFormで行う
 */
export function TestCasePreconditionList({
  testCaseId,
  initialPreconditions,
  comments,
  canEdit,
  onCommentAdded,
}: TestCasePreconditionListProps) {
  const [preconditions, setPreconditions] = useState<TestCasePrecondition[]>(initialPreconditions || []);
  const [isLoading, setIsLoading] = useState(!initialPreconditions);
  const [error, setError] = useState<string | null>(null);

  // 前提条件一覧を取得
  useEffect(() => {
    if (initialPreconditions) {
      setPreconditions(initialPreconditions);
      return;
    }

    const fetchPreconditions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await testCasesApi.getPreconditions(testCaseId);
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
    };

    fetchPreconditions();
  }, [testCaseId, initialPreconditions]);

  if (isLoading) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">前提条件</h2>
        </div>
        <div className="px-4 py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
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
        <div className="px-4 py-8 text-center">
          <p className="text-danger text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <CommentableField
      targetType="CASE"
      targetId={testCaseId}
      targetField="PRECONDITION"
      comments={comments}
      canEdit={canEdit}
      onCommentAdded={onCommentAdded}
    >
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">前提条件</h2>
        </div>

        {preconditions.length === 0 ? (
          <div className="p-4 text-center py-6">
            <ClipboardList className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-foreground-muted text-sm">前提条件が設定されていません</p>
          </div>
        ) : (
          <div>
            {preconditions.map((precondition, index) => (
              <div
                key={precondition.id}
                className={`flex items-start gap-3 p-4${index < preconditions.length - 1 ? ' border-b border-border' : ''}`}
              >
                {/* 番号 */}
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center text-xs font-medium text-foreground-muted">
                  {index + 1}
                </span>
                {/* 内容（CommentableItemでラップ） */}
                <CommentableItem
                  targetType="CASE"
                  targetId={testCaseId}
                  targetField="PRECONDITION"
                  itemId={precondition.id}
                  itemContent={precondition.content}
                  comments={comments}
                  canEdit={canEdit}
                  onCommentAdded={onCommentAdded}
                >
                  <div className="flex-1">
                    <MarkdownPreview content={precondition.content} />
                  </div>
                </CommentableItem>
              </div>
            ))}
          </div>
        )}
      </div>
    </CommentableField>
  );
}
