import { useState, useEffect } from 'react';
import {
  Loader2,
  ListOrdered,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCaseStep, type ReviewCommentWithReplies } from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';
import { CommentableField } from '../review/CommentableField';
import { CommentableItem } from '../review/CommentableItem';

interface TestCaseStepListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialSteps?: TestCaseStep[];
  /** レビューコメント一覧 */
  comments?: ReviewCommentWithReplies[];
  /** 編集権限があるか */
  canEdit?: boolean;
  /** コメント追加時のコールバック */
  onCommentAdded?: () => void;
}

/**
 * テストケースステップ一覧コンポーネント（表示のみ）
 * 編集は編集モードのTestCaseFormで行う
 */
export function TestCaseStepList({
  testCaseId,
  initialSteps,
  comments,
  canEdit,
  onCommentAdded,
}: TestCaseStepListProps) {
  const [steps, setSteps] = useState<TestCaseStep[]>(initialSteps || []);
  const [isLoading, setIsLoading] = useState(!initialSteps);
  const [error, setError] = useState<string | null>(null);

  // ステップ一覧を取得
  useEffect(() => {
    if (initialSteps) {
      setSteps(initialSteps);
      return;
    }

    const fetchSteps = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await testCasesApi.getSteps(testCaseId);
        const sorted = response.steps.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
        setSteps(sorted);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('ステップ一覧の取得に失敗しました');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSteps();
  }, [testCaseId, initialSteps]);

  if (isLoading) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">テスト手順</h2>
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
          <h2 className="font-semibold text-foreground">テスト手順</h2>
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
      targetField="STEP"
      comments={comments}
      canEdit={canEdit}
      onCommentAdded={onCommentAdded}
    >
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">テスト手順</h2>
        </div>

        {steps.length === 0 ? (
          <div className="p-4 text-center py-6">
            <ListOrdered className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-foreground-muted text-sm">テスト手順が設定されていません</p>
          </div>
        ) : (
          <div>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-4${index < steps.length - 1 ? ' border-b border-border' : ''}`}
              >
                {/* 番号（アクセントカラー） */}
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>
                {/* 内容（CommentableItemでラップ） */}
                <CommentableItem
                  targetType="CASE"
                  targetId={testCaseId}
                  targetField="STEP"
                  itemId={step.id}
                  itemContent={step.content}
                  comments={comments}
                  canEdit={canEdit}
                  onCommentAdded={onCommentAdded}
                >
                  <div className="flex-1">
                    <MarkdownPreview content={step.content} />
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
