import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateExecutionStepResultInputSchema = z.object({
  executionId: z.string().uuid().describe('テスト実行のID。create_executionで取得したIDを指定'),
  stepResultId: z.string().uuid().describe('ステップ結果のID。get_executionのstepResultsから取得'),
  status: z
    .enum(['DONE', 'SKIPPED'])
    .describe('実行結果: DONE（ステップを実行完了）, SKIPPED（ステップをスキップ）'),
  note: z
    .string()
    .max(2000)
    .optional()
    .describe('補足メモ（最大2000文字）。実行時の観察事項やスキップ理由を記録'),
  agentName: z
    .string()
    .max(100)
    .optional()
    .describe(
      '実施したAIエージェントの名前（例：Claude Code Opus4.5）。MCPツール経由での実施時に記録'
    ),
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
    executedByUser: { id: string; name: string; avatarUrl: string | null } | null;
    executedByAgentName: string | null;
  };
}

/**
 * ハンドラー
 */
const updateExecutionStepResultHandler: ToolHandler<
  UpdateExecutionStepResultInput,
  UpdateExecutionStepResultResponse
> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { executionId, stepResultId, status, note, agentName } = input;

  // 内部APIを呼び出し（agentNameを含む）
  const response = await apiClient.patch<UpdateExecutionStepResultResponse>(
    `/internal/api/executions/${executionId}/step-results/${stepResultId}`,
    { status, note, agentName },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateExecutionStepResultTool: ToolDefinition<UpdateExecutionStepResultInput> = {
  name: 'update_execution_step_result',
  description: `テスト実行中のステップ実行結果を記録します。

必須: executionId, stepResultId, status
オプション: note, agentName

返却情報: 更新後のステップ結果（ID・ステータス・メモ・実行日時・実施者情報）。

使用場面: テストステップを実行した後、その完了状態を記録する際に使用します。
ワークフロー: 前提条件確認後 → このツールでステップ実行を記録 → update_execution_expected_resultで期待結果を判定。
関連ツール: update_execution_expected_result（期待結果の合否判定）と併用してテスト結果を記録。

agentNameには実施したAIエージェントの名前を指定してください（例：Claude Code Opus4.5）。`,
  inputSchema: updateExecutionStepResultInputSchema,
  handler: updateExecutionStepResultHandler,
};
