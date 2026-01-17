/**
 * プロジェクトダッシュボード関連の型定義
 */

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
