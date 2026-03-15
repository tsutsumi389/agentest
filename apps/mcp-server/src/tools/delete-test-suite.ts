import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient, checkLockStatus } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const deleteTestSuiteInputSchema = z.object({
  testSuiteId: z
    .string()
    .uuid()
    .describe('削除するテストスイートのID。search_test_suiteで取得したIDを指定'),
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
const deleteTestSuiteHandler: ToolHandler<DeleteTestSuiteInput, DeleteTestSuiteResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { testSuiteId } = input;

  // 楽観的ロック確認：人間がロック中なら削除拒否
  await checkLockStatus('SUITE', testSuiteId);

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
  description: `テストスイートを削除します。

必須: testSuiteId

返却情報: 削除成功フラグと削除されたID。

動作: 論理削除（ソフトデリート）のため、データベースから完全には削除されず、復元可能です。

注意: テストスイートに含まれるテストケースも同時に論理削除されます。実行履歴は保持されます。`,
  inputSchema: deleteTestSuiteInputSchema,
  handler: deleteTestSuiteHandler,
};
