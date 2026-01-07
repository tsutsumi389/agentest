import { useState, useEffect, useCallback } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import { testSuitesApi, ApiError, type Precondition } from '../../lib/api';
import { MarkdownPreview } from '../common/markdown/MarkdownPreview';

interface PreconditionListProps {
  /** テストスイートID */
  testSuiteId: string;
}

/**
 * 前提条件一覧コンポーネント（表示専用）
 * 編集はテストスイートの編集フォームから行う
 */
export function PreconditionList({ testSuiteId }: PreconditionListProps) {
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
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">前提条件</h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-foreground-muted" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">前提条件</h2>
        <div className="text-center py-8">
          <p className="text-danger mb-4">{error}</p>
          <button className="btn btn-primary" onClick={fetchPreconditions}>
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">前提条件</h2>
        <p className="text-sm text-foreground-muted mt-1">
          テスト実行前に満たすべき条件
        </p>
      </div>

      {preconditions.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
          <ClipboardList className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <p className="text-foreground-muted">前提条件が設定されていません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {preconditions.map((precondition, index) => (
            <div
              key={precondition.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background-secondary"
            >
              {/* インデックス番号 */}
              <span className="w-6 h-6 rounded-full bg-background-tertiary text-foreground-muted text-xs font-medium flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>

              {/* 内容 */}
              <MarkdownPreview content={precondition.content} className="text-sm" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
