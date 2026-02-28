import { Skeleton } from '../ui/Skeleton';

interface TestCaseSidebarSkeletonProps {
  /** 表示する件数 */
  count?: number;
}

/**
 * テストケースサイドバーのスケルトンローディング
 * SortableTestCaseItemの形状を模倣したプレースホルダー
 */
export function TestCaseSidebarSkeleton({ count = 5 }: TestCaseSidebarSkeletonProps) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2 py-1.5"
          data-testid="test-case-sidebar-skeleton-item"
        >
          {/* 優先度ドット */}
          <Skeleton variant="circular" className="w-2 h-2 flex-shrink-0" />
          {/* テストケース名 */}
          <Skeleton className="flex-1 h-4" />
        </div>
      ))}
    </div>
  );
}
