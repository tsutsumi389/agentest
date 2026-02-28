import { Skeleton } from '../ui/Skeleton';

interface TestSuiteRowSkeletonProps {
  /** 表示する行数 */
  count?: number;
}

/**
 * テストスイート一覧のスケルトンローディング
 * TestSuiteRowの形状を模倣したプレースホルダー
 */
export function TestSuiteRowSkeleton({ count = 5 }: TestSuiteRowSkeletonProps) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 p-4"
          data-testid="test-suite-row-skeleton-item"
        >
          {/* アイコン */}
          <Skeleton variant="rectangular" className="w-10 h-10 flex-shrink-0" />
          {/* コンテンツ */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-2/5 h-4" />
              <Skeleton variant="rectangular" className="w-16 h-5" />
            </div>
            <Skeleton className="w-3/5 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
