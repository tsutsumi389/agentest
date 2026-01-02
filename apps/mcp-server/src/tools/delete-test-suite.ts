import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const deleteTestSuiteInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('削除対象のテストスイートID'),
});

type DeleteTestSuiteInput = z.infer<typeof deleteTestSuiteInputSchema>;

/**
 * レスポンス型
 */
interface DeleteTestSuiteResponse {
  success: boolean;
  deletedId: string;
}

/**
 * ハンドラー
 */
const deleteTestSuiteHandler: ToolHandler<DeleteTestSuiteInput, DeleteTestSuiteResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { testSuiteId } = input;

  // 内部APIを呼び出し
  const response = await apiClient.delete<DeleteTestSuiteResponse>(
    `/internal/api/test-suites/${testSuiteId}`,
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const deleteTestSuiteTool: ToolDefinition<DeleteTestSuiteInput> = {
  name: 'delete_test_suite',
  description: 'テストスイートを削除します。削除対象のテストスイートIDを指定してください。削除は論理削除で、復元可能です。',
  inputSchema: deleteTestSuiteInputSchema,
  handler: deleteTestSuiteHandler,
};
