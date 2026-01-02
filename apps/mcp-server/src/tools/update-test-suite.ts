import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateTestSuiteInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('更新対象のテストスイートID'),
  name: z.string().min(1).max(200).optional().describe('テストスイート名'),
  description: z.string().max(2000).nullable().optional().describe('説明（nullで削除）'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().describe('ステータス'),
});

type UpdateTestSuiteInput = z.infer<typeof updateTestSuiteInputSchema>;

/**
 * レスポンス型
 */
interface UpdateTestSuiteResponse {
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
const updateTestSuiteHandler: ToolHandler<UpdateTestSuiteInput, UpdateTestSuiteResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { testSuiteId, ...updateData } = input;

  // 更新フィールドが1つ以上あるか確認
  if (Object.keys(updateData).length === 0) {
    throw new Error('少なくとも1つの更新フィールドを指定してください');
  }

  // 内部APIを呼び出し
  const response = await apiClient.patch<UpdateTestSuiteResponse>(
    `/internal/api/test-suites/${testSuiteId}`,
    updateData,
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateTestSuiteTool: ToolDefinition<UpdateTestSuiteInput> = {
  name: 'update_test_suite',
  description: 'テストスイートを更新します。テストスイートIDと更新するフィールド（name, description, status）を指定してください。',
  inputSchema: updateTestSuiteInputSchema,
  handler: updateTestSuiteHandler,
};
