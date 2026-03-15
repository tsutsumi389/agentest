import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const confirmEvidenceUploadInputSchema = z.object({
  executionId: z.string().uuid().describe('テスト実行のID'),
  evidenceId: z.string().uuid().describe('upload_execution_evidenceで取得したエビデンスID'),
});

type ConfirmEvidenceUploadInput = z.infer<typeof confirmEvidenceUploadInputSchema>;

/**
 * レスポンス型
 */
interface ConfirmEvidenceUploadResponse {
  evidenceId: string;
  fileSize: number;
}

/**
 * ハンドラー
 */
const confirmEvidenceUploadHandler: ToolHandler<
  ConfirmEvidenceUploadInput,
  ConfirmEvidenceUploadResponse
> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { executionId, evidenceId } = input;

  const response = await apiClient.post<ConfirmEvidenceUploadResponse>(
    `/internal/api/executions/${executionId}/evidences/${evidenceId}/confirm`,
    {},
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const confirmEvidenceUploadTool: ToolDefinition<ConfirmEvidenceUploadInput> = {
  name: 'confirm_evidence_upload',
  description: `エビデンスのアップロード完了を確認します。

upload_execution_evidenceで取得したpresigned URLを使ってcurlでファイルをアップロードした後、
このツールを呼び出してアップロード完了を確認してください。
S3上のファイルメタデータからファイルサイズを取得し、DBレコードを更新します。

必須: executionId, evidenceId（upload_execution_evidenceの返却値）`,
  inputSchema: confirmEvidenceUploadInputSchema,
  handler: confirmEvidenceUploadHandler,
};
