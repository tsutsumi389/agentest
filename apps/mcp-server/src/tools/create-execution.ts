import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const createExecutionInputSchema = z.object({
  testSuiteId: z
    .string()
    .uuid()
    .describe('テスト実行を開始するテストスイートのID。search_test_suiteで取得したIDを指定'),
  environmentId: z
    .string()
    .uuid()
    .optional()
    .describe('実行環境ID。get_projectで取得した環境一覧から選択。省略時は環境なしで実行'),
});

type CreateExecutionInput = z.infer<typeof createExecutionInputSchema>;

/**
 * レスポンス型
 */
interface CreateExecutionResponse {
  execution: {
    id: string;
    testSuiteId: string;
    environmentId: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const createExecutionHandler: ToolHandler<CreateExecutionInput, CreateExecutionResponse> = async (
  input,
  context
) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  // 内部APIを呼び出し
  const response = await apiClient.post<CreateExecutionResponse>(
    `/internal/api/test-suites/${input.testSuiteId}/executions`,
    {
      environmentId: input.environmentId,
    },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const createExecutionTool: ToolDefinition<CreateExecutionInput> = {
  name: 'create_execution',
  description: `テストスイートのテスト実行を新規開始します。

必須: testSuiteId
オプション: environmentId

返却情報: 作成された実行ID・作成日時。

動作: テストスイートの現時点の内容（テストケース・前提条件・ステップ・期待結果）がスナップショットとして保存され、各項目の結果行が自動作成されます。

使用場面: テストを実行する際の最初のステップとして使用します。返却された実行IDを使って、get_executionで結果行のIDを取得し、update_execution_*ツールで各結果を記録していきます。`,
  inputSchema: createExecutionInputSchema,
  handler: createExecutionHandler,
};
