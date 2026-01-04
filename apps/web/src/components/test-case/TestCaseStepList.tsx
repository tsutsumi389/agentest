import { useState, useEffect } from 'react';
import {
  Loader2,
  ListOrdered,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCaseStep, type ProjectMemberRole } from '../../lib/api';

interface TestCaseStepListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialSteps?: TestCaseStep[];
  /** 現在のユーザーのロール（未使用、互換性のため維持） */
  currentRole?: 'OWNER' | ProjectMemberRole;
  /** 更新時のコールバック（未使用、互換性のため維持） */
  onUpdated?: () => void;
}

/**
 * テストケースステップ一覧コンポーネント（表示のみ）
 * 編集は編集モードのTestCaseFormで行う
 */
export function TestCaseStepList({
  testCaseId,
  initialSteps,
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">テスト手順</h3>
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
          <h3 className="text-sm font-semibold text-foreground">テスト手順</h3>
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
        <h3 className="text-sm font-semibold text-foreground">テスト手順</h3>
      </div>

      {steps.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
          <ListOrdered className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
          <p className="text-foreground-muted text-sm">テスト手順が設定されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className="flex items-start gap-3 p-3 bg-background-secondary rounded-lg"
            >
              {/* 番号（アクセントカラー） */}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-medium">
                {index + 1}
              </span>
              {/* 内容 */}
              <p className="text-sm text-foreground flex-1 whitespace-pre-wrap">
                {step.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
