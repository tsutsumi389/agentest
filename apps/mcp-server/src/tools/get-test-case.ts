import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const getTestCaseInputSchema = z.object({
  testCaseId: z.string().uuid().describe('テストケースID（必須）'),
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
const getTestCaseHandler: ToolHandler<GetTestCaseInput, GetTestCaseResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.get<GetTestCaseResponse>(`/internal/api/test-cases/${input.testCaseId}`, {
    userId,
  });

  return response;
};

/**
 * ツール定義
 */
export const getTestCaseTool: ToolDefinition<GetTestCaseInput> = {
  name: 'get_test_case',
  description: 'テストケースの詳細情報を取得します。前提条件、ステップ、期待結果も含まれます。',
  inputSchema: getTestCaseInputSchema,
  handler: getTestCaseHandler,
};
