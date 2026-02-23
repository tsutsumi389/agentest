import fs from 'node:fs/promises';
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

  const { executionId, expectedResultId, filePath, description } = input;

  // ファイルサイズの事前チェック（100MB上限、API側と同じ）
  const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;
  let fileBuffer: Buffer;
  try {
    const fileStats = await fs.stat(filePath);
    if (fileStats.size > MAX_UPLOAD_SIZE) {
      throw new Error(`ファイルサイズが上限（${MAX_UPLOAD_SIZE / 1024 / 1024}MB）を超えています`);
    }
    fileBuffer = await fs.readFile(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') {
      throw new Error(`ファイルが見つかりません: ${filePath} - パスを確認してください`);
    }
    if (nodeError.code === 'EACCES') {
      throw new Error(`ファイルへのアクセス権がありません: ${filePath}`);
    }
    throw error;
  }

  const fileName = input.fileName || nodePath.basename(filePath);
  const fileType = input.fileType || mime.lookup(filePath) || 'application/octet-stream';

  // multipart/form-data で Internal API に送信
  const fields: Record<string, string> = {};
  if (description) {
    fields.description = description;
  }

  const response = await apiClient.postMultipart<UploadExecutionEvidenceResponse>(
    `/internal/api/executions/${executionId}/expected-results/${expectedResultId}/evidences`,
    {
      file: { buffer: fileBuffer, fileName, mimeType: fileType },
      fields,
    },
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

必須: executionId, expectedResultId, filePath
オプション: fileName（省略時はパスから自動検出）, fileType（省略時は拡張子から自動検出）, description

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
