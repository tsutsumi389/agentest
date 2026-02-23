import nodePath from 'node:path';
import mime from 'mime-types';
import { z } from 'zod';
import type { ToolHandler, ToolDefinition } from './index.js';
import { apiClient } from '../clients/api-client.js';

/**
 * 入力スキーマ
 */
export const uploadExecutionEvidenceInputSchema = z.object({
  executionId: z.string().uuid().describe('テスト実行のID。create_executionで取得したIDを指定'),
  expectedResultId: z.string().uuid().describe('エビデンスを添付する期待結果のID。get_executionのexpectedResultsから取得'),
  filePath: z.string().min(1).describe('アップロードするファイルのローカルパス。例: /tmp/screenshot.png'),
  fileName: z.string().min(1).max(255).optional().describe('ファイル名（省略時はfilePathから自動検出）。例: screenshot.png'),
  fileType: z.string().min(1).optional().describe('MIMEタイプ（省略時は拡張子から自動検出）。例: image/png'),
  description: z.string().max(2000).optional().describe('エビデンスの説明（最大2000文字）。何を示すエビデンスかを記載'),
});

type UploadExecutionEvidenceInput = z.infer<typeof uploadExecutionEvidenceInputSchema>;

/**
 * presigned URLレスポンス型
 */
interface UploadUrlResponse {
  evidenceId: string;
  uploadUrl: string;
}

/**
 * ツールの返却型（構造化データ）
 */
interface UploadExecutionEvidenceResult {
  evidenceId: string;
  uploadUrl: string;
  filePath: string;
  contentType: string;
  confirmEndpoint: string;
  message: string;
}

/**
 * ハンドラー
 */
const uploadExecutionEvidenceHandler: ToolHandler<UploadExecutionEvidenceInput, UploadExecutionEvidenceResult> = async (input, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('認証されていません');
  }

  const { executionId, expectedResultId, filePath, description } = input;

  // ファイル名・MIMEタイプをパスから推測（ファイルアクセスは不要）
  const fileName = input.fileName || nodePath.basename(filePath);
  const fileType = input.fileType || mime.lookup(filePath) || 'application/octet-stream';

  // presigned URL取得（JSON POST）
  const response = await apiClient.post<UploadUrlResponse>(
    `/internal/api/executions/${executionId}/expected-results/${expectedResultId}/evidences/upload-url`,
    { fileName, fileType, description },
    { userId }
  );

  // 構造化データを返却（curlコマンドは構築しない = コマンドインジェクション対策）
  return {
    evidenceId: response.evidenceId,
    uploadUrl: response.uploadUrl,
    filePath,
    contentType: fileType,
    confirmEndpoint: `/internal/api/executions/${executionId}/evidences/${response.evidenceId}/confirm`,
    message: [
      'presigned URLが生成されました。以下の手順でアップロードを完了してください:',
      '',
      '1. curlでファイルをアップロード:',
      `   curl -X PUT -H 'Content-Type: ${fileType}' --upload-file '${filePath}' '${response.uploadUrl}'`,
      '',
      '2. アップロード確認:',
      `   confirm_evidence_upload(executionId="${executionId}", evidenceId="${response.evidenceId}")`,
    ].join('\n'),
  };
};

/**
 * ツール定義
 */
export const uploadExecutionEvidenceTool: ToolDefinition<UploadExecutionEvidenceInput> = {
  name: 'upload_execution_evidence',
  description: `テスト実行の期待結果にエビデンスファイルをアップロードするためのpresigned URLを生成します。

【3ステップフロー】
1. このツールを呼び出してpresigned URLを取得
2. レスポンスの uploadUrl, filePath, contentType を使ってcurlを構築・実行:
   curl -X PUT -H 'Content-Type: {contentType}' --upload-file '{filePath}' '{uploadUrl}'
3. confirm_evidence_upload ツールでアップロード完了を確認

必須: executionId, expectedResultId, filePath
オプション: fileName（省略時はパスから自動検出）, fileType（省略時は拡張子から自動検出）, description

対応形式:
- 画像: image/jpeg, image/png, image/gif, image/webp
- 動画: video/mp4, video/webm
- 音声: audio/mp3, audio/wav
- ドキュメント: application/pdf, text/plain, application/json

制限: 1つの期待結果あたり最大10件までアップロード可能。presigned URLは5分間有効。`,
  inputSchema: uploadExecutionEvidenceInputSchema,
  handler: uploadExecutionEvidenceHandler,
};
