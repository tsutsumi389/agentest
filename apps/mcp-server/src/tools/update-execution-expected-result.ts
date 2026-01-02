import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateExecutionExpectedResultInputSchema = z.object({
  executionId: z.string().uuid().describe('実行ID'),
  expectedResultId: z.string().uuid().describe('期待結果ID'),
  status: z.enum(['PASS', 'FAIL', 'SKIPPED', 'NOT_EXECUTABLE']).describe('ステータス（PASS: 合格, FAIL: 不合格, SKIPPED: スキップ, NOT_EXECUTABLE: 実行不可）'),
  note: z.string().max(2000).optional().describe('メモ'),
});

type UpdateExecutionExpectedResultInput = z.infer<typeof updateExecutionExpectedResultInputSchema>;

/**
 * レスポンス型
 */
interface UpdateExecutionExpectedResultResponse {
  expectedResult: {
    id: string;
    executionId: string;
    status: string;
    note: string | null;
    judgedAt: string | null;
  };
}

/**
 * ハンドラー
 */
const updateExecutionExpectedResultHandler: ToolHandler<UpdateExecutionExpectedResultInput, UpdateExecutionExpectedResultResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { executionId, expectedResultId, status, note } = input;

  // 内部APIを呼び出し
  const response = await apiClient.patch<UpdateExecutionExpectedResultResponse>(
    `/internal/api/executions/${executionId}/expected-results/${expectedResultId}`,
    { status, note },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateExecutionExpectedResultTool: ToolDefinition<UpdateExecutionExpectedResultInput> = {
  name: 'update_execution_expected_result',
  description: '実行中のテストの期待結果を更新します。実行ID、期待結果ID、ステータス（PASS/FAIL/SKIPPED/NOT_EXECUTABLE）を指定してください。',
  inputSchema: updateExecutionExpectedResultInputSchema,
  handler: updateExecutionExpectedResultHandler,
};
