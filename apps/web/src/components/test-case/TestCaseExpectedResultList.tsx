import { useState, useEffect } from 'react';
import {
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCaseExpectedResult, type ProjectMemberRole } from '../../lib/api';

interface TestCaseExpectedResultListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialExpectedResults?: TestCaseExpectedResult[];
  /** 現在のユーザーのロール（未使用、互換性のため維持） */
  currentRole?: 'OWNER' | ProjectMemberRole;
  /** 更新時のコールバック（未使用、互換性のため維持） */
  onUpdated?: () => void;
}

/**
 * テストケース期待結果一覧コンポーネント（表示のみ）
 * 編集は編集モードのTestCaseFormで行う
 */
export function TestCaseExpectedResultList({
  testCaseId,
  initialExpectedResults,
}: TestCaseExpectedResultListProps) {
  const [expectedResults, setExpectedResults] = useState<TestCaseExpectedResult[]>(initialExpectedResults || []);
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
        const sorted = response.expectedResults.sort((a, b) => a.orderKey.localeCompare(b.orderKey));
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">期待結果</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">期待結果</h3>
        </div>
        <div className="text-center py-8">
          <p className="text-danger text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">期待結果</h3>
      </div>

      {expectedResults.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
          <CheckCircle className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
          <p className="text-foreground-muted text-sm">期待結果が設定されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expectedResults.map((expectedResult, index) => (
            <div
              key={expectedResult.id}
              className="flex items-start gap-3 p-3 bg-background-secondary rounded-lg"
            >
              {/* 番号（成功カラー） */}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-medium">
                {index + 1}
              </span>
              {/* 内容 */}
              <p className="text-sm text-foreground flex-1 whitespace-pre-wrap">
                {expectedResult.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
