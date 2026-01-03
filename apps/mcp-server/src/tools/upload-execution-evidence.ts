import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const uploadExecutionEvidenceInputSchema = z.object({
  executionId: z.string().uuid().describe('テスト実行のID。create_executionで取得したIDを指定'),
  expectedResultId: z.string().uuid().describe('エビデンスを添付する期待結果のID。get_executionのexpectedResultsから取得'),
  fileName: z.string().min(1).max(255).describe('アップロードするファイル名（拡張子含む、1-255文字）。例: screenshot.png'),
  fileData: z.string().min(1).describe('ファイルのBase64エンコード文字列。バイナリデータをBase64に変換して指定'),
  fileType: z.string().min(1).describe('ファイルのMIMEタイプ。例: image/png, image/jpeg, video/mp4, application/pdf'),
  description: z.string().max(2000).optional().describe('エビデンスの説明（最大2000文字）。何を示すエビデンスかを記載'),
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
  description: `テスト実行の期待結果にエビデンスファイルをアップロードします。

必須: executionId, expectedResultId, fileName, fileData, fileType
オプション: description

対応形式:
- 画像: image/jpeg, image/png, image/gif, image/webp
- 動画: video/mp4, video/webm
- 音声: audio/mp3, audio/wav
- ドキュメント: application/pdf, text/plain, application/json

制限: 1つの期待結果あたり最大10件までアップロード可能。

返却情報: アップロードされたエビデンス情報（ID・ファイルURL・サイズ等）。

使用場面: テスト結果の証拠（スクリーンショット、画面録画、ログファイル等）を記録する際に使用します。
ワークフロー: update_execution_expected_resultで結果を判定した後 → このツールでエビデンスを添付。`,
  inputSchema: uploadExecutionEvidenceInputSchema,
  handler: uploadExecutionEvidenceHandler,
};
