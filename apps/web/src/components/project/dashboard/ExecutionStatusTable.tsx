import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, SkipForward, Clock, Loader2, ChevronRight } from 'lucide-react';
import type {
  ProjectDashboardStats,
  FailingTestSuiteItem,
  SkippedTestSuiteItem,
  NeverExecutedTestSuiteItem,
  InProgressTestSuiteItem,
} from '@agentest/shared';
import { formatRelativeTimeOrDefault } from '../../../lib/date';

type TabType = 'failing' | 'skipped' | 'neverExecuted' | 'inProgress';

interface ExecutionStatusTableProps {
  stats: ProjectDashboardStats;
}

/**
 * タブ定義
 */
const TAB_CONFIG: Record<
  TabType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  failing: { label: '失敗中', icon: AlertTriangle },
  skipped: { label: 'スキップ中', icon: SkipForward },
  neverExecuted: { label: 'テスト未実施', icon: Clock },
  inProgress: { label: 'テスト実行中', icon: Loader2 },
};

/**
 * テスト実行状況一覧コンポーネント
 * 失敗中・スキップ中・テスト未実施・テスト実行中のテストスイートをタブ切り替えで表示
 */
export function ExecutionStatusTable({ stats }: ExecutionStatusTableProps) {
  const [activeTab, setActiveTab] = useState<TabType>('failing');
  const { executionStatusSuites } = stats;

  // 各タブの件数を取得
  const counts: Record<TabType, number> = {
    failing: executionStatusSuites.failingSuites.total,
    skipped: executionStatusSuites.skippedSuites.total,
    neverExecuted: executionStatusSuites.neverExecutedSuites.total,
    inProgress: executionStatusSuites.inProgressSuites.total,
  };

  // 全体の件数が0なら非表示
  const totalCount = counts.failing + counts.skipped + counts.neverExecuted + counts.inProgress;
  if (totalCount === 0) {
    return null;
  }

  // タブパネルのID生成
  const getTabPanelId = (tab: TabType) => `execution-status-tabpanel-${tab}`;
  const getTabId = (tab: TabType) => `execution-status-tab-${tab}`;

  return (
    <div className="card p-6">
      {/* ヘッダー */}
      <h2 className="text-lg font-semibold text-foreground mb-4">テスト実行状況</h2>

      {/* タブボタン */}
      <div
        role="tablist"
        aria-label="テスト実行状況のカテゴリ"
        className="flex border-b border-border mb-4"
      >
        {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => {
          const { label, icon: Icon } = TAB_CONFIG[tab];
          const count = counts[tab];
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              id={getTabId(tab)}
              role="tab"
              aria-selected={isActive}
              aria-controls={getTabPanelId(tab)}
              onClick={() => setActiveTab(tab)}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
                border-b-2 -mb-px
                ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-foreground-muted hover:text-foreground'
                }
                ${count === 0 ? 'opacity-50' : ''}
              `}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
              <span
                className={`
                  px-1.5 py-0.5 text-xs rounded
                  ${isActive ? 'bg-accent-subtle text-accent' : 'bg-background-tertiary text-foreground-muted'}
                `}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* リスト表示 */}
      <div
        id={getTabPanelId(activeTab)}
        role="tabpanel"
        aria-labelledby={getTabId(activeTab)}
        className="space-y-2"
      >
        {activeTab === 'failing' && (
          <FailingSuitesList
            items={executionStatusSuites.failingSuites.items}
            total={executionStatusSuites.failingSuites.total}
          />
        )}
        {activeTab === 'skipped' && (
          <SkippedSuitesList
            items={executionStatusSuites.skippedSuites.items}
            total={executionStatusSuites.skippedSuites.total}
          />
        )}
        {activeTab === 'neverExecuted' && (
          <NeverExecutedSuitesList
            items={executionStatusSuites.neverExecutedSuites.items}
            total={executionStatusSuites.neverExecutedSuites.total}
          />
        )}
        {activeTab === 'inProgress' && (
          <InProgressSuitesList
            items={executionStatusSuites.inProgressSuites.items}
            total={executionStatusSuites.inProgressSuites.total}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 失敗中テストスイート一覧
 */
function FailingSuitesList({ items, total }: { items: FailingTestSuiteItem[]; total: number }) {
  if (items.length === 0) {
    return <EmptyState message="失敗中のテストスイートはありません" />;
  }

  return (
    <>
      {items.map((item) => (
        <TestSuiteListItem
          key={item.testSuiteId}
          linkTo={`/executions/${item.lastExecutionId}`}
          icon={<AlertTriangle className="w-4 h-4 text-danger" />}
          name={item.testSuiteName}
          environment={item.environment}
          details={
            <>
              <span>
                失敗: {item.failCount}/{item.totalExpectedResults}
              </span>
              <span className="mx-2">|</span>
              <span>最終実行: {formatRelativeTimeOrDefault(item.lastExecutedAt)}</span>
            </>
          }
        />
      ))}
      <PaginationInfo displayed={items.length} total={total} />
    </>
  );
}

/**
 * スキップ中テストスイート一覧
 */
function SkippedSuitesList({ items, total }: { items: SkippedTestSuiteItem[]; total: number }) {
  if (items.length === 0) {
    return <EmptyState message="スキップ中のテストスイートはありません" />;
  }

  return (
    <>
      {items.map((item) => (
        <TestSuiteListItem
          key={item.testSuiteId}
          linkTo={`/executions/${item.lastExecutionId}`}
          icon={<SkipForward className="w-4 h-4 text-warning" />}
          name={item.testSuiteName}
          environment={item.environment}
          details={
            <>
              <span>
                スキップ: {item.skippedCount}/{item.totalExpectedResults}
              </span>
              <span className="mx-2">|</span>
              <span>最終実行: {formatRelativeTimeOrDefault(item.lastExecutedAt)}</span>
            </>
          }
        />
      ))}
      <PaginationInfo displayed={items.length} total={total} />
    </>
  );
}

/**
 * テスト未実施スイート一覧
 */
function NeverExecutedSuitesList({
  items,
  total,
}: {
  items: NeverExecutedTestSuiteItem[];
  total: number;
}) {
  if (items.length === 0) {
    return <EmptyState message="未実施のテストスイートはありません" />;
  }

  return (
    <>
      {items.map((item) => (
        <TestSuiteListItem
          key={item.testSuiteId}
          linkTo={`/test-suites/${item.testSuiteId}`}
          icon={<Clock className="w-4 h-4 text-foreground-muted" />}
          name={item.testSuiteName}
          environment={null}
          details={
            <>
              <span>テストケース: {item.testCaseCount}件</span>
              <span className="mx-2">|</span>
              <span>作成: {formatRelativeTimeOrDefault(item.createdAt)}</span>
            </>
          }
        />
      ))}
      <PaginationInfo displayed={items.length} total={total} />
    </>
  );
}

/**
 * テスト実行中スイート一覧
 */
function InProgressSuitesList({
  items,
  total,
}: {
  items: InProgressTestSuiteItem[];
  total: number;
}) {
  if (items.length === 0) {
    return <EmptyState message="実行中のテストスイートはありません" />;
  }

  return (
    <>
      {items.map((item) => (
        <TestSuiteListItem
          key={item.testSuiteId}
          linkTo={`/executions/${item.lastExecutionId}`}
          icon={<Loader2 className="w-4 h-4 text-accent animate-spin" />}
          name={item.testSuiteName}
          environment={item.environment}
          details={
            <>
              <span>
                未判定: {item.pendingCount}/{item.totalExpectedResults}
              </span>
              <span className="mx-2">|</span>
              <span>最終実行: {formatRelativeTimeOrDefault(item.lastExecutedAt)}</span>
            </>
          }
        />
      ))}
      <PaginationInfo displayed={items.length} total={total} />
    </>
  );
}

/**
 * テストスイートリストアイテム（共通）
 */
function TestSuiteListItem({
  linkTo,
  icon,
  name,
  environment,
  details,
}: {
  linkTo: string;
  icon: React.ReactNode;
  name: string;
  environment: { id: string; name: string } | null;
  details: React.ReactNode;
}) {
  return (
    <Link
      to={linkTo}
      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors group"
    >
      {/* アイコン */}
      <div className="flex-shrink-0 mt-0.5">{icon}</div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{name}</p>
        {environment && (
          <p className="text-sm text-foreground-muted truncate">環境: {environment.name}</p>
        )}
        <p className="text-xs text-foreground-subtle mt-1">{details}</p>
      </div>

      {/* 矢印 */}
      <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-foreground-muted" />
      </div>
    </Link>
  );
}

/**
 * ページネーション情報表示
 */
function PaginationInfo({ displayed, total }: { displayed: number; total: number }) {
  // 表示件数と総数が同じ場合は表示しない
  if (displayed >= total) {
    return null;
  }

  return (
    <div className="text-center py-3 text-sm text-foreground-muted border-t border-border mt-2">
      表示中: {displayed}件 / 全{total}件
    </div>
  );
}

/**
 * 空状態表示
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-foreground-muted">{message}</p>
    </div>
  );
}
