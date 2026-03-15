import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const getTestCaseInputSchema = z.object({
  testCaseId: z
    .string()
    .uuid()
    .describe('取得するテストケースのID。search_test_caseまたはget_test_suiteで取得したIDを指定'),
});

type GetTestCaseInput = z.infer<typeof getTestCaseInputSchema>;

/**
 * 前提条件型
 */
interface TestCasePrecondition {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * ステップ型
 */
interface TestCaseStep {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 期待結果型
 */
interface TestCaseExpectedResult {
  id: string;
  testCaseId: string;
  content: string;
  orderKey: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * レスポンス型
 */
interface GetTestCaseResponse {
  testCase: {
    id: string;
    testSuiteId: string;
    testSuite: {
      id: string;
      name: string;
      projectId: string;
    };
    title: string;
    description: string | null;
    priority: string;
    status: string;
    orderKey: string;
    createdByUser: {
      id: string;
      name: string | null;
      avatarUrl: string | null;
    } | null;
    preconditions: TestCasePrecondition[];
    steps: TestCaseStep[];
    expectedResults: TestCaseExpectedResult[];
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const getTestCaseHandler: ToolHandler<GetTestCaseInput, GetTestCaseResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<GetTestCaseResponse>(
    `/internal/api/test-cases/${input.testCaseId}`,
    {
      userId,
    }
  );

  return response;
};

/**
 * ツール定義
 */
export const getTestCaseTool: ToolDefinition<GetTestCaseInput> = {
  name: 'get_test_case',
  description: `テストケースの詳細情報を取得します。

返却情報: テストケースID・タイトル・説明・優先度・ステータス、所属テストスイート、作成者、前提条件一覧（ID・内容・順序）、ステップ一覧（ID・内容・順序）、期待結果一覧（ID・内容・順序）。

使用場面: テストケースの全内容を確認したり、update_test_caseで更新する前に現在の内容を取得する際に使用します。
関連ツール: update_test_caseで内容を更新、create_executionでテスト実行を開始。`,
  inputSchema: getTestCaseInputSchema,
  handler: getTestCaseHandler,
};
