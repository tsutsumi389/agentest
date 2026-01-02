import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateTestCaseInputSchema = z.object({
  testCaseId: z.string().uuid().describe('更新対象のテストケースID'),
  title: z.string().min(1).max(200).optional().describe('テストケースタイトル'),
  description: z.string().max(2000).nullable().optional().describe('説明（nullで削除）'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe('優先度'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().describe('ステータス'),
});

type UpdateTestCaseInput = z.infer<typeof updateTestCaseInputSchema>;

/**
 * レスポンス型
 */
interface UpdateTestCaseResponse {
  testCase: {
    id: string;
    testSuiteId: string;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const updateTestCaseHandler: ToolHandler<UpdateTestCaseInput, UpdateTestCaseResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { testCaseId, ...updateData } = input;

  // 更新フィールドが1つ以上あるか確認
  if (Object.keys(updateData).length === 0) {
    throw new Error('少なくとも1つの更新フィールドを指定してください');
  }

  // 内部APIを呼び出し
  const response = await apiClient.patch<UpdateTestCaseResponse>(
    `/internal/api/test-cases/${testCaseId}`,
    updateData,
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateTestCaseTool: ToolDefinition<UpdateTestCaseInput> = {
  name: 'update_test_case',
  description: 'テストケースを更新します。テストケースIDと更新するフィールド（title, description, priority, status）を指定してください。',
  inputSchema: updateTestCaseInputSchema,
  handler: updateTestCaseHandler,
};
