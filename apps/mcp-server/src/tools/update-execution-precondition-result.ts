import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateExecutionPreconditionResultInputSchema = z.object({
  executionId: z.string().uuid().describe('テスト実行のID。create_executionで取得したIDを指定'),
  preconditionResultId: z.string().uuid().describe('前提条件結果のID。get_executionのpreconditionResultsから取得'),
  status: z.enum(['MET', 'NOT_MET']).describe('判定結果: MET（条件を満たしている）, NOT_MET（条件を満たしていない）'),
  note: z.string().max(2000).optional().describe('補足メモ（最大2000文字）。条件の確認方法や問題点を記録'),
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
  description: `テスト実行中の前提条件チェック結果を記録します。

必須: executionId, preconditionResultId, status
オプション: note

返却情報: 更新後の前提条件結果（ID・ステータス・メモ・確認日時）。

使用場面: テスト実行開始後、テストステップを実行する前に前提条件が満たされているかを確認・記録する際に使用します。
ワークフロー: create_execution → get_execution（結果IDを取得）→ このツールで前提条件を確認 → update_execution_step_resultでステップ実行。`,
  inputSchema: updateExecutionPreconditionResultInputSchema,
  handler: updateExecutionPreconditionResultHandler,
};
