import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const uploadExecutionEvidenceInputSchema = z.object({
  executionId: z.string().uuid().describe('実行ID'),
  expectedResultId: z.string().uuid().describe('期待結果ID'),
  fileName: z.string().min(1).max(255).describe('ファイル名（拡張子含む）'),
  fileData: z.string().min(1).describe('Base64エンコードされたファイルデータ'),
  fileType: z.string().min(1).describe('MIMEタイプ（例: image/png, image/jpeg）'),
  description: z.string().max(2000).optional().describe('エビデンスの説明'),
});

type UploadExecutionEvidenceInput = z.infer<typeof uploadExecutionEvidenceInputSchema>;

/**
 * レスポンス型
 */
interface UploadExecutionEvidenceResponse {
  evidence: {
    id: string;
    expectedResultId: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
    description: string | null;
    uploadedByUserId: string;
    createdAt: string;
  };
}

/**
 * ハンドラー
 */
const uploadExecutionEvidenceHandler: ToolHandler<UploadExecutionEvidenceInput, UploadExecutionEvidenceResponse> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { executionId, expectedResultId, fileName, fileData, fileType, description } = input;

  // 内部APIを呼び出し
  const response = await apiClient.post<UploadExecutionEvidenceResponse>(
    `/internal/api/executions/${executionId}/expected-results/${expectedResultId}/evidences`,
    { fileName, fileData, fileType, description },
    { userId }
  );

  return response;
};

/**
 * ツール定義
 */
export const uploadExecutionEvidenceTool: ToolDefinition<UploadExecutionEvidenceInput> = {
  name: 'upload_execution_evidence',
  description: '実行中のテストの期待結果にエビデンス（スクリーンショット等）をアップロードします。実行ID、期待結果ID、ファイル名、Base64エンコードされたファイルデータ、MIMEタイプを指定してください。対応形式: 画像(jpeg/png/gif/webp等)、動画(mp4/webm等)、音声(mp3/wav等)、ドキュメント(pdf/txt/json等)。1期待結果あたり最大10件までアップロード可能です。',
  inputSchema: uploadExecutionEvidenceInputSchema,
  handler: uploadExecutionEvidenceHandler,
};
