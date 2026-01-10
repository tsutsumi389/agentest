import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient, checkLockStatus } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const deleteTestCaseInputSchema = z.object({
  testCaseId: z.string().uuid().describe('削除するテストケースのID。search_test_caseまたはget_test_suiteで取得したIDを指定'),
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

  // 楽観的ロック確認：人間がロック中なら削除拒否
  await checkLockStatus('CASE', testCaseId);

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
  description: `テストケースを削除します。

必須: testCaseId

返却情報: 削除成功フラグと削除されたID。

動作: 論理削除（ソフトデリート）のため、データベースから完全には削除されず、復元可能です。

注意: テストケースに含まれる前提条件・ステップ・期待結果も同時に論理削除されます。過去の実行履歴は保持されます。`,
  inputSchema: deleteTestCaseInputSchema,
  handler: deleteTestCaseHandler,
};
