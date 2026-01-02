import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const deleteTestCaseInputSchema = z.object({
  testCaseId: z.string().uuid().describe('削除対象のテストケースID'),
});

type DeleteTestCaseInput = z.infer<typeof deleteTestCaseInputSchema>;

/**
 * レスポンス型
 */
interface DeleteTestCaseResponse {
  success: boolean;
  deletedId: string;
}

/**
 * ハンドラー
 */
const deleteTestCaseHandler: ToolHandler<DeleteTestCaseInput, DeleteTestCaseResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { testCaseId } = input;

  // 内部APIを呼び出し
  const response = await apiClient.delete<DeleteTestCaseResponse>(
    `/internal/api/test-cases/${testCaseId}`,
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const deleteTestCaseTool: ToolDefinition<DeleteTestCaseInput> = {
  name: 'delete_test_case',
  description: 'テストケースを削除します。削除対象のテストケースIDを指定してください。削除は論理削除で、復元可能です。',
  inputSchema: deleteTestCaseInputSchema,
  handler: deleteTestCaseHandler,
};
