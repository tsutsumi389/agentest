import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const createTestSuiteInputSchema = z.object({
  projectId: z.string().uuid().describe('作成先プロジェクトID'),
  name: z.string().min(1).max(200).describe('テストスイート名'),
  description: z.string().max(2000).optional().describe('説明'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT').describe('ステータス'),
});

type CreateTestSuiteInput = z.infer<typeof createTestSuiteInputSchema>;

/**
 * レスポンス型
 */
interface CreateTestSuiteResponse {
  testSuite: {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const createTestSuiteHandler: ToolHandler<CreateTestSuiteInput, CreateTestSuiteResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.post<CreateTestSuiteResponse>(
    '/internal/api/test-suites',
    {
      projectId: input.projectId,
      name: input.name,
      description: input.description,
      status: input.status,
    },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const createTestSuiteTool: ToolDefinition<CreateTestSuiteInput> = {
  name: 'create_test_suite',
  description: 'テストスイートを作成します。プロジェクトIDとテストスイート名を指定してください。',
  inputSchema: createTestSuiteInputSchema,
  handler: createTestSuiteHandler,
};
