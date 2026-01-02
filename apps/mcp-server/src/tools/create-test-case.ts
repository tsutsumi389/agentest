import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 子エンティティ作成用スキーマ
 */
const childEntitySchema = z.object({
  content: z.string().min(1).max(10000).describe('テキスト内容'),
});

/**
 * 入力スキーマ
 */
export const createTestCaseInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('作成先テストスイートID'),
  title: z.string().min(1).max(200).describe('テストケースタイトル'),
  description: z.string().max(2000).optional().describe('説明'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM').describe('優先度'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT').describe('ステータス'),
  preconditions: z.array(childEntitySchema).optional().describe('前提条件の配列'),
  steps: z.array(childEntitySchema).optional().describe('テスト手順の配列'),
  expectedResults: z.array(childEntitySchema).optional().describe('期待結果の配列'),
});

type CreateTestCaseInput = z.infer<typeof createTestCaseInputSchema>;

/**
 * 子エンティティ型
 */
interface ChildEntity {
  id: string;
  content: string;
  orderKey: string;
}

/**
 * レスポンス型
 */
interface CreateTestCaseResponse {
  testCase: {
    id: string;
    testSuiteId: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    orderKey: string;
    createdAt: string;
    updatedAt: string;
    preconditions?: ChildEntity[];
    steps?: ChildEntity[];
    expectedResults?: ChildEntity[];
  };
}

/**
 * ハンドラー
 */
const createTestCaseHandler: ToolHandler<CreateTestCaseInput, CreateTestCaseResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し（子エンティティ含む）
  const response = await apiClient.post<CreateTestCaseResponse>(
    '/internal/api/test-cases',
    {
      testSuiteId: input.testSuiteId,
      title: input.title,
      description: input.description,
      priority: input.priority,
      status: input.status,
      preconditions: input.preconditions,
      steps: input.steps,
      expectedResults: input.expectedResults,
    },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const createTestCaseTool: ToolDefinition<CreateTestCaseInput> = {
  name: 'create_test_case',
  description: 'テストケースを作成します。テストスイートIDとタイトルを指定してください。前提条件(preconditions)、テスト手順(steps)、期待結果(expectedResults)を一括で登録できます。',
  inputSchema: createTestCaseInputSchema as z.ZodType<CreateTestCaseInput>,
  handler: createTestCaseHandler,
};
