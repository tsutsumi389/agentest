import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const updateExecutionExpectedResultInputSchema = z.object({
  executionId: z.string().uuid().describe('テスト実行のID。create_executionで取得したIDを指定'),
  expectedResultId: z.string().uuid().describe('期待結果のID。get_executionのexpectedResultsから取得'),
  status: z.enum(['PASS', 'FAIL', 'SKIPPED']).describe('判定結果: PASS（期待通り）, FAIL（期待と異なる）, SKIPPED（確認をスキップ）'),
  note: z.string().max(2000).optional().describe('補足メモ（最大2000文字）。FAILの場合は実際の結果や差異を記録'),
  agentName: z.string().max(100).optional().describe('実施したAIエージェントの名前（例：Claude Code Opus4.5）。MCPツール経由での実施時に記録'),
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
    judgedByUser: { id: string; name: string; avatarUrl: string | null } | null;
    judgedByAgentName: string | null;
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

  const { executionId, expectedResultId, status, note, agentName } = input;

  // 内部APIを呼び出し（agentNameを含む）
  const response = await apiClient.patch<UpdateExecutionExpectedResultResponse>(
    `/internal/api/executions/${executionId}/expected-results/${expectedResultId}`,
    { status, note, agentName },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const updateExecutionExpectedResultTool: ToolDefinition<UpdateExecutionExpectedResultInput> = {
  name: 'update_execution_expected_result',
  description: `テスト実行中の期待結果の合否判定を記録します。

必須: executionId, expectedResultId, status
オプション: note, agentName

返却情報: 更新後の期待結果（ID・ステータス・メモ・判定日時・実施者情報）。

使用場面: テストステップ実行後、期待した結果が得られたかを判定・記録する際に使用します。
ワークフロー: update_execution_step_resultでステップ実行記録後 → このツールで結果を判定 → 必要に応じてupload_execution_evidenceでエビデンスを添付。
ステータスの使い分け: PASS（正常）, FAIL（バグ発見）, SKIPPED（関連ステップがスキップされた場合や確認できない場合）。

agentNameには実施したAIエージェントの名前を指定してください（例：Claude Code Opus4.5）。`,
  inputSchema: updateExecutionExpectedResultInputSchema,
  handler: updateExecutionExpectedResultHandler,
};
