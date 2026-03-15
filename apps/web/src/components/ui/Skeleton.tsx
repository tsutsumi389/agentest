interface SkeletonProps {
  /** カスタムクラス（widthやheightを指定） */
  className?: string;
  /** バリアント */
  variant?: 'text' | 'circular' | 'rectangular';
}

/**
 * スケルトンローディングコンポーネント
 * コンテンツ読み込み中のプレースホルダー表示
 */
export function Skeleton({ className = '', variant = 'text' }: SkeletonProps) {
  const baseClass =
    'animate-skeleton bg-gradient-to-r from-background-secondary via-background-tertiary to-background-secondary bg-[length:200%_100%]';

  const variantClass = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-md',
  };

  return (
    <div
      className={`${baseClass} ${variantClass[variant]} ${className}`}
      role="status"
      aria-label="読み込み中"
    />
  );
}

/**
 * カードスケルトン
 * カード形式のコンテンツ用
 */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="w-3/4" />
          <Skeleton className="w-1/2" />
        </div>
      </div>
      <Skeleton className="w-full h-20" variant="rectangular" />
    </div>
  );
}

/**
 * テーブル行スケルトン
 * リスト表示用
 */
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className={i === 0 ? 'w-1/4' : 'flex-1'} />
      ))}
    </div>
  );
}
