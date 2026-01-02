import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const createExecutionInputSchema = z.object({
  testSuiteId: z.string().uuid().describe('実行対象のテストスイートID'),
  environmentId: z.string().uuid().optional().describe('実行環境ID（オプション）'),
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
    status: string;
    startedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * ハンドラー
 */
const createExecutionHandler: ToolHandler<CreateExecutionInput, CreateExecutionResponse> = async (input, context) => {
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
  description: 'テスト実行を開始します。テストスイートIDを指定すると、スナップショットと全結果行が自動作成されます。',
  inputSchema: createExecutionInputSchema,
  handler: createExecutionHandler,
};
