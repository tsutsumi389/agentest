import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateExecutionPreconditionResultInputSchema = z.object({
  executionId: z.string().uuid().describe('実行ID'),
  preconditionResultId: z.string().uuid().describe('事前条件結果ID'),
  status: z.enum(['MET', 'NOT_MET']).describe('ステータス（MET: 満たした, NOT_MET: 満たさなかった）'),
  note: z.string().max(2000).optional().describe('メモ'),
});

type UpdateExecutionPreconditionResultInput = z.infer<typeof updateExecutionPreconditionResultInputSchema>;

/**
 * レスポンス型
 */
interface UpdateExecutionPreconditionResultResponse {
  preconditionResult: {
    id: string;
    executionId: string;
    status: string;
    note: string | null;
    checkedAt: string | null;
  };
}

/**
 * ハンドラー
 */
const updateExecutionPreconditionResultHandler: ToolHandler<UpdateExecutionPreconditionResultInput, UpdateExecutionPreconditionResultResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { executionId, preconditionResultId, status, note } = input;

  // 内部APIを呼び出し
  const response = await apiClient.patch<UpdateExecutionPreconditionResultResponse>(
    `/internal/api/executions/${executionId}/precondition-results/${preconditionResultId}`,
    { status, note },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateExecutionPreconditionResultTool: ToolDefinition<UpdateExecutionPreconditionResultInput> = {
  name: 'update_execution_precondition_result',
  description: '実行中のテストの事前条件結果を更新します。実行ID、事前条件結果ID、ステータス（MET/NOT_MET）を指定してください。',
  inputSchema: updateExecutionPreconditionResultInputSchema,
  handler: updateExecutionPreconditionResultHandler,
};
