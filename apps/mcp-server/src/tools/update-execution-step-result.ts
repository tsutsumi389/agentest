import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateExecutionStepResultInputSchema = z.object({
  executionId: z.string().uuid().describe('実行ID'),
  stepResultId: z.string().uuid().describe('ステップ結果ID'),
  status: z.enum(['DONE', 'SKIPPED']).describe('ステータス（DONE: 実行済み, SKIPPED: スキップ）'),
  note: z.string().max(2000).optional().describe('メモ'),
});

type UpdateExecutionStepResultInput = z.infer<typeof updateExecutionStepResultInputSchema>;

/**
 * レスポンス型
 */
interface UpdateExecutionStepResultResponse {
  stepResult: {
    id: string;
    executionId: string;
    status: string;
    note: string | null;
    executedAt: string | null;
  };
}

/**
 * ハンドラー
 */
const updateExecutionStepResultHandler: ToolHandler<UpdateExecutionStepResultInput, UpdateExecutionStepResultResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { executionId, stepResultId, status, note } = input;

  // 内部APIを呼び出し
  const response = await apiClient.patch<UpdateExecutionStepResultResponse>(
    `/internal/api/executions/${executionId}/step-results/${stepResultId}`,
    { status, note },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateExecutionStepResultTool: ToolDefinition<UpdateExecutionStepResultInput> = {
  name: 'update_execution_step_result',
  description: '実行中のテストのステップ結果を更新します。実行ID、ステップ結果ID、ステータス（DONE/SKIPPED）を指定してください。',
  inputSchema: updateExecutionStepResultInputSchema,
  handler: updateExecutionStepResultHandler,
};
