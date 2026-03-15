import { useState, useEffect } from 'react';
import { Loader2, CheckCircle } from 'lucide-react';
import {
  testCasesApi,
  ApiError,
  type TestCaseExpectedResult,
  type ReviewCommentWithReplies,
} from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';
import { CommentableField } from '../review/CommentableField';
import { CommentableItem } from '../review/CommentableItem';

interface TestCaseExpectedResultListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialExpectedResults?: TestCaseExpectedResult[];
  /** レビューコメント一覧 */
  comments?: ReviewCommentWithReplies[];
  /** 編集権限があるか */
  canEdit?: boolean;
  /** コメント追加時のコールバック */
  onCommentAdded?: () => void;
}

/**
 * テストケース期待結果一覧コンポーネント（表示のみ）
 * 編集は編集モードのTestCaseFormで行う
 */
export function TestCaseExpectedResultList({
  testCaseId,
  initialExpectedResults,
  comments,
  canEdit,
  onCommentAdded,
}: TestCaseExpectedResultListProps) {
  const [expectedResults, setExpectedResults] = useState<TestCaseExpectedResult[]>(
    initialExpectedResults || []
  );
  const [isLoading, setIsLoading] = useState(!initialExpectedResults);
  const [error, setError] = useState<string | null>(null);

  // 期待結果一覧を取得
  useEffect(() => {
    if (initialExpectedResults) {
      setExpectedResults(initialExpectedResults);
      return;
    }

    const fetchExpectedResults = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await testCasesApi.getExpectedResults(testCaseId);
        const sorted = response.expectedResults.sort((a, b) =>
          a.orderKey.localeCompare(b.orderKey)
        );
        setExpectedResults(sorted);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('期待結果一覧の取得に失敗しました');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchExpectedResults();
  }, [testCaseId, initialExpectedResults]);

  if (isLoading) {
    return (
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">期待結果</h2>
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
          <h2 className="font-semibold text-foreground">期待結果</h2>
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
      targetField="EXPECTED_RESULT"
      comments={comments}
      canEdit={canEdit}
      onCommentAdded={onCommentAdded}
    >
      <div className="card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground">期待結果</h2>
        </div>

        {expectedResults.length === 0 ? (
          <div className="p-4 text-center py-6">
            <CheckCircle className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-foreground-muted text-sm">期待結果が設定されていません</p>
          </div>
        ) : (
          <div>
            {expectedResults.map((expectedResult, index) => (
              <div
                key={expectedResult.id}
                className={`flex items-start gap-3 p-4${index < expectedResults.length - 1 ? ' border-b border-border' : ''}`}
              >
                {/* 番号（成功カラー） */}
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-medium">
                  {index + 1}
                </span>
                {/* 内容（CommentableItemでラップ） */}
                <CommentableItem
                  targetType="CASE"
                  targetId={testCaseId}
                  targetField="EXPECTED_RESULT"
                  itemId={expectedResult.id}
                  itemContent={expectedResult.content}
                  comments={comments}
                  canEdit={canEdit}
                  onCommentAdded={onCommentAdded}
                >
                  <div className="flex-1">
                    <MarkdownPreview content={expectedResult.content} />
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
