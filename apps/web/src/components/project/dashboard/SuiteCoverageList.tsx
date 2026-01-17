import { Link, useParams } from 'react-router';
import { FileText, ChevronRight } from 'lucide-react';
import type { ProjectDashboardStats, SuiteCoverageItem } from '@agentest/shared';
import { SimpleProgressBar } from '../../ui';
import { formatRelativeTimeOrDefault } from '../../../lib/date';

interface SuiteCoverageListProps {
  stats: ProjectDashboardStats;
}

/**
 * 成功率に応じた色を返す
 * - 80%以上: success（緑）
 * - 50-80%: warning（黄）
 * - 50%未満: danger（赤）
 */
function getPassRateColor(passRate: number): 'success' | 'warning' | 'danger' {
  if (passRate >= 80) return 'success';
  if (passRate >= 50) return 'warning';
  return 'danger';
}

/**
 * テストスイート別カバレッジコンポーネント
 * 各テストスイートのカバレッジ状況をリスト表示
 */
export function SuiteCoverageList({ stats }: SuiteCoverageListProps) {
  const { projectId } = useParams<{ projectId: string }>();

  // projectIdが取得できない場合は何も表示しない
  if (!projectId) {
    return null;
  }

  const { suiteCoverage } = stats;

  return (
    <div className="card p-6">
      {/* ヘッダー */}
      <h2 className="text-lg font-semibold text-foreground mb-4">
        テストスイート別カバレッジ
      </h2>

      {/* リスト表示 */}
      {suiteCoverage.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {suiteCoverage.map((item) => (
            <SuiteCoverageListItem
              key={item.testSuiteId}
              item={item}
              projectId={projectId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * スイートカバレッジリストアイテム
 */
function SuiteCoverageListItem({
  item,
  projectId,
}: {
  item: SuiteCoverageItem;
  projectId: string;
}) {
  const color = getPassRateColor(item.passRate);

  return (
    <Link
      to={`/projects/${projectId}/test-suites/${item.testSuiteId}`}
      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors group"
    >
      {/* アイコン */}
      <div className="flex-shrink-0">
        <FileText className="w-4 h-4 text-foreground-muted" />
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{item.name}</p>
        <div className="flex items-center gap-4 text-sm text-foreground-muted mt-1">
          <span>
            テストケース: {item.executedCount}/{item.testCaseCount}
          </span>
          <span>
            最終実行: {formatRelativeTimeOrDefault(item.lastExecutedAt, '未実行')}
          </span>
        </div>
      </div>

      {/* 成功率と進捗バー */}
      <div className="flex-shrink-0 w-32">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-foreground">
            {item.passRate.toFixed(0)}%
          </span>
        </div>
        <SimpleProgressBar value={item.passRate} color={color} size="sm" />
      </div>

      {/* 矢印 */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-foreground-muted" />
      </div>
    </Link>
  );
}

/**
 * 空状態表示
 */
function EmptyState() {
  return (
    <div className="text-center py-8">
      <p className="text-foreground-muted">テストスイートがありません</p>
    </div>
  );
}
