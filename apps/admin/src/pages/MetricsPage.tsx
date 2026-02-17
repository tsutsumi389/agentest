import { BarChart3 } from 'lucide-react';

/**
 * メトリクスページ
 * アクティブユーザーメトリクス機能は現在準備中
 */
export function MetricsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">メトリクス</h1>
          <p className="text-foreground-muted mt-1">
            利用状況メトリクスの表示
          </p>
        </div>

        <div className="bg-background-secondary rounded-lg border border-border p-12 text-center">
          <BarChart3 className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            準備中
          </h2>
          <p className="text-foreground-muted">
            メトリクス機能は現在開発中です。
          </p>
        </div>
      </div>
    </div>
  );
}
