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

/**
 * @deprecated 要注意テスト一覧（テストケース単位）。ExecutionStatusSuitesを使用してください。
 */
export interface AttentionRequired {
  /** 失敗中テスト */
  failingTests: FailingTestItem[];
  /** 長期未実行テスト */
  longNotExecuted: LongNotExecutedItem[];
  /** 不安定なテスト */
  flakyTests: FlakyTestItem[];
}

// ============================================================
// テスト実行状況（テストスイート単位）
// ============================================================

/** 失敗中テストスイートの項目 */
export interface FailingTestSuiteItem {
  /** テストスイートID */
  testSuiteId: string;
  /** テストスイート名 */
  testSuiteName: string;
  /** 最終実行ID */
  lastExecutionId: string;
  /** 最終実行日時 */
  lastExecutedAt: Date | string;
  /** 環境情報 */
  environment: { id: string; name: string } | null;
  /** 失敗件数 */
  failCount: number;
  /** 期待結果総数 */
  totalExpectedResults: number;
}

/** スキップ中テストスイートの項目 */
export interface SkippedTestSuiteItem {
  /** テストスイートID */
  testSuiteId: string;
  /** テストスイート名 */
  testSuiteName: string;
  /** 最終実行ID */
  lastExecutionId: string;
  /** 最終実行日時 */
  lastExecutedAt: Date | string;
  /** 環境情報 */
  environment: { id: string; name: string } | null;
  /** スキップ件数 */
  skippedCount: number;
  /** 期待結果総数 */
  totalExpectedResults: number;
}

/** 未実行テストスイートの項目 */
export interface NeverExecutedTestSuiteItem {
  /** テストスイートID */
  testSuiteId: string;
  /** テストスイート名 */
  testSuiteName: string;
  /** 作成日時 */
  createdAt: Date | string;
  /** テストケース数 */
  testCaseCount: number;
}

/** 実行中テストスイートの項目 */
export interface InProgressTestSuiteItem {
  /** テストスイートID */
  testSuiteId: string;
  /** テストスイート名 */
  testSuiteName: string;
  /** 最終実行ID */
  lastExecutionId: string;
  /** 最終実行日時 */
  lastExecutedAt: Date | string;
  /** 環境情報 */
  environment: { id: string; name: string } | null;
  /** 未判定件数 */
  pendingCount: number;
  /** 期待結果総数 */
  totalExpectedResults: number;
}

/** ページネーション付きリスト */
export interface PaginatedList<T> {
  /** 項目リスト */
  items: T[];
  /** 総件数 */
  total: number;
}

/** テスト実行状況（テストスイート単位） */
export interface ExecutionStatusSuites {
  /** 失敗中テストスイート */
  failingSuites: PaginatedList<FailingTestSuiteItem>;
  /** スキップ中テストスイート */
  skippedSuites: PaginatedList<SkippedTestSuiteItem>;
  /** 未実行テストスイート */
  neverExecutedSuites: PaginatedList<NeverExecutedTestSuiteItem>;
  /** 実行中テストスイート */
  inProgressSuites: PaginatedList<InProgressTestSuiteItem>;
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
  /**
   * @deprecated 要注意テスト一覧（テストケース単位）。executionStatusSuitesを使用してください。
   */
  attentionRequired: AttentionRequired;
  /** テスト実行状況（テストスイート単位） */
  executionStatusSuites: ExecutionStatusSuites;
  /** 最近の活動 */
  recentActivities: RecentActivityItem[];
}
