/**
 * ユーザーダッシュボード関連の型定義
 */

/**
 * 最近のテスト実行結果アイテム
 */
export interface RecentExecutionItem {
  executionId: string;
  projectId: string;
  projectName: string;
  testSuiteId: string;
  testSuiteName: string;
  environment: { id: string; name: string } | null;
  createdAt: string;
  judgmentCounts: {
    PASS: number;
    FAIL: number;
    PENDING: number;
    SKIPPED: number;
  };
}
