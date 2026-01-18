/**
 * プロジェクトダッシュボード関連の型定義
 */

/** プロジェクトダッシュボード統計のサマリー */
export interface ProjectDashboardSummary {
  /** テストスイート総数 */
  totalTestSuites: number;
  /** テストケース総数 */
  totalTestCases: number;
  /** 期待結果総数 */
  totalExpectedResults: number;
}

/** ダッシュボードフィルターパラメータ */
export interface DashboardFilterParams {
  /** 環境ID */
  environmentId?: string;
  /** ラベルID一覧 */
  labelIds?: string[];
}

/** 実行結果の分布 */
export interface ResultDistribution {
  /** 成功 */
  pass: number;
  /** 失敗 */
  fail: number;
  /** スキップ */
  skipped: number;
  /** 未判定 */
  pending: number;
}

/** 失敗中テストの項目 */
export interface FailingTestItem {
  /** テストケースID */
  testCaseId: string;
  /** テストケースタイトル */
  title: string;
  /** テストスイートID */
  testSuiteId: string;
  /** テストスイート名 */
  testSuiteName: string;
  /** 最終実行日時 */
  lastExecutedAt: Date | string;
  /** 連続失敗回数 */
  consecutiveFailures: number;
}

/** 長期未実行テストの項目 */
export interface LongNotExecutedItem {
  /** テストケースID */
  testCaseId: string;
  /** テストケースタイトル */
  title: string;
  /** テストスイートID */
  testSuiteId: string;
  /** テストスイート名 */
  testSuiteName: string;
  /** 最終実行日時（null: 一度も実行されていない） */
  lastExecutedAt: Date | string | null;
  /** 未実行日数 */
  daysSinceLastExecution: number | null;
}

/** 不安定なテストの項目 */
export interface FlakyTestItem {
  /** テストケースID */
  testCaseId: string;
  /** テストケースタイトル */
  title: string;
  /** テストスイートID */
  testSuiteId: string;
  /** テストスイート名 */
  testSuiteName: string;
  /** 過去10回の成功率（50-90%） */
  passRate: number;
  /** 過去10回の実行数 */
  totalExecutions: number;
}

/** 要注意テスト一覧 */
export interface AttentionRequired {
  /** 失敗中テスト */
  failingTests: FailingTestItem[];
  /** 長期未実行テスト */
  longNotExecuted: LongNotExecutedItem[];
  /** 不安定なテスト */
  flakyTests: FlakyTestItem[];
}

/** 最近の活動種別 */
export type RecentActivityType = 'execution' | 'testCaseUpdate' | 'review';

/** 最近の活動項目 */
export interface RecentActivityItem {
  /** 活動ID */
  id: string;
  /** 活動種別 */
  type: RecentActivityType;
  /** 活動日時 */
  occurredAt: Date | string;
  /** 説明 */
  description: string;
  /** 関連テストスイートID（オプション） */
  testSuiteId?: string;
  /** 関連テストスイート名（オプション） */
  testSuiteName?: string;
  /** 関連テストケースID（オプション） */
  testCaseId?: string;
  /** 関連テストケース名（オプション） */
  testCaseName?: string;
  /** アクター情報 */
  actor?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
}

/** プロジェクトダッシュボード統計 */
export interface ProjectDashboardStats {
  /** サマリー */
  summary: ProjectDashboardSummary;
  /** 実行結果の分布 */
  resultDistribution: ResultDistribution;
  /** 要注意テスト一覧 */
  attentionRequired: AttentionRequired;
  /** 最近の活動 */
  recentActivities: RecentActivityItem[];
}
