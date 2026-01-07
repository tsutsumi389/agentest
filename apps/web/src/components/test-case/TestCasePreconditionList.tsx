import { useState, useEffect } from 'react';
import {
  Loader2,
  ClipboardList,
} from 'lucide-react';
import { testCasesApi, ApiError, type TestCasePrecondition, type ProjectMemberRole } from '../../lib/api';
import { MarkdownPreview } from '../common/markdown';

interface TestCasePreconditionListProps {
  /** テストケースID */
  testCaseId: string;
  /** 初期データ（オプティミスティック更新用） */
  initialPreconditions?: TestCasePrecondition[];
  /** 現在のユーザーのロール（未使用、互換性のため維持） */
  currentRole?: 'OWNER' | ProjectMemberRole;
  /** 更新時のコールバック（未使用、互換性のため維持） */
  onUpdated?: () => void;
}

/**
 * テストケース前提条件一覧コンポーネント（表示のみ）
 * 編集は編集モードのTestCaseFormで行う
 */
export function TestCasePreconditionList({
  testCaseId,
  initialPreconditions,
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
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">前提条件</h3>
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
          <h3 className="text-sm font-semibold text-foreground">前提条件</h3>
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
        <h3 className="text-sm font-semibold text-foreground">前提条件</h3>
      </div>

      {preconditions.length === 0 ? (
        <div className="text-center py-6 border-2 border-dashed border-border rounded-lg">
          <ClipboardList className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
          <p className="text-foreground-muted text-sm">前提条件が設定されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {preconditions.map((precondition, index) => (
            <div
              key={precondition.id}
              className="flex items-start gap-3 p-3 bg-background-secondary rounded-lg"
            >
              {/* 番号 */}
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center text-xs font-medium text-foreground-muted">
                {index + 1}
              </span>
              {/* 内容 */}
              <div className="flex-1">
                <MarkdownPreview content={precondition.content} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
