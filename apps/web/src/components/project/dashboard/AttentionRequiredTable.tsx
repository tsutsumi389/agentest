import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { AlertTriangle, Clock, Activity, ChevronRight } from 'lucide-react';
import type {
  ProjectDashboardStats,
  FailingTestItem,
  LongNotExecutedItem,
  FlakyTestItem,
} from '@agentest/shared';
import { formatRelativeTimeOrDefault } from '../../../lib/date';

type TabType = 'failing' | 'longNotExecuted' | 'flaky';

interface AttentionRequiredTableProps {
  stats: ProjectDashboardStats;
}

/**
 * タブ定義
 */
const TAB_CONFIG: Record<TabType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  failing: { label: '失敗中', icon: AlertTriangle },
  longNotExecuted: { label: '長期未実行', icon: Clock },
  flaky: { label: '不安定', icon: Activity },
};

/**
 * 要注意テスト一覧コンポーネント
 * 失敗中・長期未実行・不安定なテストをタブ切り替えで表示
 */
export function AttentionRequiredTable({ stats }: AttentionRequiredTableProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>('failing');

  const { attentionRequired } = stats;

  // 各タブの件数を取得
  const counts: Record<TabType, number> = {
    failing: attentionRequired.failingTests.length,
    longNotExecuted: attentionRequired.longNotExecuted.length,
    flaky: attentionRequired.flakyTests.length,
  };

  // 全体の件数が0なら非表示
  const totalCount = counts.failing + counts.longNotExecuted + counts.flaky;
  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="card p-6">
      {/* ヘッダー */}
      <h2 className="text-lg font-semibold text-foreground mb-4">要注意テスト</h2>

      {/* タブボタン */}
      <div className="flex border-b border-border mb-4">
        {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => {
          const { label, icon: Icon } = TAB_CONFIG[tab];
          const count = counts[tab];
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors
                border-b-2 -mb-px
                ${isActive
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
      <div className="space-y-2">
        {activeTab === 'failing' && (
          <FailingTestsList
            items={attentionRequired.failingTests}
            projectId={projectId!}
          />
        )}
        {activeTab === 'longNotExecuted' && (
          <LongNotExecutedList
            items={attentionRequired.longNotExecuted}
            projectId={projectId!}
          />
        )}
        {activeTab === 'flaky' && (
          <FlakyTestsList
            items={attentionRequired.flakyTests}
            projectId={projectId!}
          />
        )}
      </div>
    </div>
  );
}

/**
 * 失敗中テスト一覧
 */
function FailingTestsList({
  items,
  projectId,
}: {
  items: FailingTestItem[];
  projectId: string;
}) {
  if (items.length === 0) {
    return <EmptyState message="失敗中のテストはありません" />;
  }

  return (
    <>
      {items.map((item) => (
        <TestListItem
          key={item.testCaseId}
          projectId={projectId}
          testSuiteId={item.testSuiteId}
          testCaseId={item.testCaseId}
          icon={<AlertTriangle className="w-4 h-4 text-danger" />}
          title={item.title}
          suiteName={item.testSuiteName}
          details={
            <>
              <span>最終実行: {formatRelativeTimeOrDefault(item.lastExecutedAt)}</span>
              <span className="mx-2">|</span>
              <span>連続失敗: {item.consecutiveFailures}回</span>
            </>
          }
        />
      ))}
    </>
  );
}

/**
 * 長期未実行テスト一覧
 */
function LongNotExecutedList({
  items,
  projectId,
}: {
  items: LongNotExecutedItem[];
  projectId: string;
}) {
  if (items.length === 0) {
    return <EmptyState message="長期未実行のテストはありません" />;
  }

  return (
    <>
      {items.map((item) => (
        <TestListItem
          key={item.testCaseId}
          projectId={projectId}
          testSuiteId={item.testSuiteId}
          testCaseId={item.testCaseId}
          icon={<Clock className="w-4 h-4 text-warning" />}
          title={item.title}
          suiteName={item.testSuiteName}
          details={
            <>
              <span>
                最終実行:{' '}
                {formatRelativeTimeOrDefault(item.lastExecutedAt, '未実行')}
              </span>
              <span className="mx-2">|</span>
              <span>
                未実行日数:{' '}
                {item.daysSinceLastExecution !== null
                  ? `${item.daysSinceLastExecution}日`
                  : '-'}
              </span>
            </>
          }
        />
      ))}
    </>
  );
}

/**
 * 不安定テスト一覧
 */
function FlakyTestsList({
  items,
  projectId,
}: {
  items: FlakyTestItem[];
  projectId: string;
}) {
  if (items.length === 0) {
    return <EmptyState message="不安定なテストはありません" />;
  }

  return (
    <>
      {items.map((item) => (
        <TestListItem
          key={item.testCaseId}
          projectId={projectId}
          testSuiteId={item.testSuiteId}
          testCaseId={item.testCaseId}
          icon={<Activity className="w-4 h-4 text-accent" />}
          title={item.title}
          suiteName={item.testSuiteName}
          details={
            <>
              <span>成功率: {item.passRate.toFixed(0)}%</span>
              <span className="mx-2">|</span>
              <span>実行回数: {item.totalExecutions}回</span>
            </>
          }
        />
      ))}
    </>
  );
}

/**
 * テストリストアイテム（共通）
 */
function TestListItem({
  projectId,
  testSuiteId,
  testCaseId,
  icon,
  title,
  suiteName,
  details,
}: {
  projectId: string;
  testSuiteId: string;
  testCaseId: string;
  icon: React.ReactNode;
  title: string;
  suiteName: string;
  details: React.ReactNode;
}) {
  return (
    <Link
      to={`/projects/${projectId}/test-suites/${testSuiteId}/test-cases/${testCaseId}`}
      className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background-secondary hover:bg-background-tertiary transition-colors group"
    >
      {/* アイコン */}
      <div className="flex-shrink-0 mt-0.5">{icon}</div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{title}</p>
        <p className="text-sm text-foreground-muted truncate">
          スイート: {suiteName}
        </p>
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
 * 空状態表示
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-foreground-muted">{message}</p>
    </div>
  );
}
