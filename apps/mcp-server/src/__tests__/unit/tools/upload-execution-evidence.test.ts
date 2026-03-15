import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  post: vi.fn(),
  postMultipart: vi.fn(),
}));

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// モック設定後にインポート
import {
  uploadExecutionEvidenceTool,
  uploadExecutionEvidenceInputSchema,
} from '../../../tools/upload-execution-evidence.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const TEST_EXPECTED_RESULT_ID = '88888888-8888-8888-8888-888888888888';
const TEST_EVIDENCE_ID = '99999999-9999-9999-9999-999999999999';

describe('uploadExecutionEvidenceTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(uploadExecutionEvidenceTool.name).toBe('upload_execution_evidence');
      expect(uploadExecutionEvidenceTool.description).toContain('presigned URL');
      expect(uploadExecutionEvidenceTool.description).toContain('3ステップ');
    });

    it('入力スキーマが定義されている', () => {
      expect(uploadExecutionEvidenceTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('filePathのみで有効（fileName/fileTypeは自動検出）', () => {
      const result = uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      });
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
      expect(result.expectedResultId).toBe(TEST_EXPECTED_RESULT_ID);
      expect(result.filePath).toBe('/tmp/screenshot.png');
      expect(result.fileName).toBeUndefined();
      expect(result.fileType).toBeUndefined();
      expect(result.description).toBeUndefined();
    });

    it('fileName/fileType/descriptionを明示的に指定できる', () => {
      const result = uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
        fileName: 'custom_name.png',
        fileType: 'image/png',
        description: 'エラー画面のスクリーンショット',
      });
      expect(result.fileName).toBe('custom_name.png');
      expect(result.fileType).toBe('image/png');
      expect(result.description).toBe('エラー画面のスクリーンショット');
    });

    it('executionId, expectedResultId, filePathは必須', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({})).toThrow();
      expect(() =>
        uploadExecutionEvidenceInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
        })
      ).toThrow();
      expect(() =>
        uploadExecutionEvidenceInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
          expectedResultId: TEST_EXPECTED_RESULT_ID,
        })
      ).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() =>
        uploadExecutionEvidenceInputSchema.parse({
          executionId: 'invalid-uuid',
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          filePath: '/tmp/test.png',
        })
      ).toThrow();
    });

    it('空のfilePathはエラー', () => {
      expect(() =>
        uploadExecutionEvidenceInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          filePath: '',
        })
      ).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('presigned URLを取得して構造化データを返す', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        evidenceId: TEST_EVIDENCE_ID,
        uploadUrl: 'https://minio.example.com/presigned-put-url',
      });

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      };

      const result = (await uploadExecutionEvidenceTool.handler(input, context)) as Record<
        string,
        unknown
      >;

      // JSON POSTで送信されること（multipartではない）
      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}/evidences/upload-url`,
        { fileName: 'screenshot.png', fileType: 'image/png', description: undefined },
        { userId: TEST_USER_ID }
      );

      // 構造化データが返されること
      expect(result).toHaveProperty('evidenceId', TEST_EVIDENCE_ID);
      expect(result).toHaveProperty('uploadUrl', 'https://minio.example.com/presigned-put-url');
      expect(result).toHaveProperty('filePath', '/tmp/screenshot.png');
      expect(result).toHaveProperty('contentType', 'image/png');
      expect(result).toHaveProperty('confirmEndpoint');
      expect(result).toHaveProperty('message');

      // fs.readFile が呼ばれないこと（ファイルアクセスしない）
      expect(mockApiClient.postMultipart).not.toHaveBeenCalled();
    });

    it('fileName/fileTypeを明示的に上書きできる', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        evidenceId: TEST_EVIDENCE_ID,
        uploadUrl: 'https://presigned-url',
      });

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
        fileName: 'custom_name.jpg',
        fileType: 'image/jpeg',
      };

      const result = (await uploadExecutionEvidenceTool.handler(input, context)) as Record<
        string,
        unknown
      >;

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          fileName: 'custom_name.jpg',
          fileType: 'image/jpeg',
        }),
        expect.any(Object)
      );
      expect(result).toHaveProperty('contentType', 'image/jpeg');
    });

    it('descriptionをAPIに送信する', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        evidenceId: TEST_EVIDENCE_ID,
        uploadUrl: 'https://presigned-url',
      });

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
        description: 'テスト説明',
      };

      await uploadExecutionEvidenceTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          description: 'テスト説明',
        }),
        expect.any(Object)
      );
    });

    it('拡張子からMIMEタイプを検出できない場合はapplication/octet-streamを使用', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        evidenceId: TEST_EVIDENCE_ID,
        uploadUrl: 'https://presigned-url',
      });

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/noext',
      };

      const result = (await uploadExecutionEvidenceTool.handler(input, context)) as Record<
        string,
        unknown
      >;

      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          fileType: 'application/octet-stream',
        }),
        expect.any(Object)
      );
      expect(result).toHaveProperty('contentType', 'application/octet-stream');
    });

    it('APIエラーを伝播する', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied or execution is not in progress')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403'
      );
    });
  });
});
