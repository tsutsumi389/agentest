import { FileText, Clock, TrendingUp, Play } from 'lucide-react';

// ============================================================================
// 型定義
// ============================================================================

/** プロジェクトダッシュボード統計のサマリー */
export interface ProjectDashboardSummary {
  /** テストケース総数 */
  totalTestCases: number;
  /** 最終実行日時 */
  lastExecutionAt: Date | string | null;
  /** 全体成功率（0-100） */
  overallPassRate: number;
  /** 実行中テスト数 */
  inProgressExecutions: number;
}

/** プロジェクトダッシュボード統計 */
export interface ProjectDashboardStats {
  summary: ProjectDashboardSummary;
}

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * 相対時間をフォーマット
 */
function formatRelativeTime(date: Date | string | null): string {
  if (!date) return '--';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'たった今';
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 30) return `${diffDays}日前`;
  return new Date(date).toLocaleDateString('ja-JP');
}

/**
 * 成功率に基づく色を取得
 */
function getPassRateColor(rate: number): 'success' | 'warning' | 'danger' {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

/**
 * 実行中テスト数に基づく色を取得
 */
function getRunningColor(count: number): 'running' | 'muted' {
  return count > 0 ? 'running' : 'muted';
}

// ============================================================================
// 内部コンポーネント
// ============================================================================

/**
 * KPIカード（内部コンポーネント）
 * SummaryCardパターンを拡張し、文字列値とrunning色をサポート
 */
function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: 'success' | 'danger' | 'warning' | 'muted' | 'accent' | 'running';
}) {
  const colorClasses = {
    success: 'bg-success-subtle text-success',
    danger: 'bg-danger-subtle text-danger',
    warning: 'bg-warning-subtle text-warning',
    muted: 'bg-background-tertiary text-foreground-muted',
    accent: 'bg-accent-subtle text-accent',
    running: 'bg-running-subtle text-running',
  };

  const isRunning = color === 'running';

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}
        >
          <Icon className={`w-5 h-5 ${isRunning ? 'animate-pulse' : ''}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground-muted">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 公開コンポーネント
// ============================================================================

interface KpiSummaryCardsProps {
  /** ダッシュボード統計データ */
  stats: ProjectDashboardStats;
}

/**
 * KPIサマリーカード
 * プロジェクトのテスト状況を4つのカードで表示
 */
export function KpiSummaryCards({ stats }: KpiSummaryCardsProps) {
  const { summary } = stats;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* テストケース総数 */}
      <KpiCard
        icon={FileText}
        label="テストケース"
        value={summary.totalTestCases}
        color="accent"
      />

      {/* 最終実行日時 */}
      <KpiCard
        icon={Clock}
        label="最終実行"
        value={formatRelativeTime(summary.lastExecutionAt)}
        color="muted"
      />

      {/* 成功率 */}
      <KpiCard
        icon={TrendingUp}
        label="成功率"
        value={`${Math.floor(summary.overallPassRate)}%`}
        color={getPassRateColor(summary.overallPassRate)}
      />

      {/* 実行中テスト */}
      <KpiCard
        icon={Play}
        label="実行中"
        value={summary.inProgressExecutions}
        color={getRunningColor(summary.inProgressExecutions)}
      />
    </div>
  );
}
