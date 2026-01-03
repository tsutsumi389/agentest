import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateTestSuiteInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('更新するテストスイートのID。search_test_suiteで取得したIDを指定'),
  name: z.string().min(1).max(200).optional().describe('新しいテストスイート名（1-200文字）'),
  description: z.string().max(2000).nullable().optional().describe('新しい説明（最大2000文字）。nullを指定すると説明を削除'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional().describe('新しいステータス: DRAFT（下書き）, ACTIVE（有効）, ARCHIVED（アーカイブ済み）'),
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
  description: `テストスイートの情報を更新します。

必須: testSuiteId
更新可能: name, description, status（少なくとも1つ指定）

返却情報: 更新後のテストスイート情報。

使用場面: テストスイートの名前変更、説明の追加・更新・削除、ステータス変更を行う際に使用します。
注意: 前提条件の編集はこのツールでは行えません。テストケースレベルの前提条件はupdate_test_caseで編集できます。`,
  inputSchema: updateTestSuiteInputSchema,
  handler: updateTestSuiteHandler,
};
