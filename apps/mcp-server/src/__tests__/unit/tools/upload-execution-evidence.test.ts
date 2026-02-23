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

// fsのモック
const mockFs = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  default: mockFs,
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

// テスト用バッファ（1x1ピクセルのPNG画像）
const TEST_PNG_BUFFER = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

describe('uploadExecutionEvidenceTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルトのfsモック: 正常にバッファを返す
    mockFs.stat.mockResolvedValue({ size: TEST_PNG_BUFFER.length });
    mockFs.readFile.mockResolvedValue(TEST_PNG_BUFFER);
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(uploadExecutionEvidenceTool.name).toBe('upload_execution_evidence');
      expect(uploadExecutionEvidenceTool.description).toContain('エビデンス');
      expect(uploadExecutionEvidenceTool.description).toContain('アップロード');
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
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
      })).toThrow();
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
      })).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: 'invalid-uuid',
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/test.png',
      })).toThrow();

      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: 'invalid-uuid',
        filePath: '/tmp/test.png',
      })).toThrow();
    });

    it('空のfilePathはエラー', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '',
      })).toThrow();
    });

    it('descriptionは2000文字以下', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/test.png',
        description: 'a'.repeat(2001),
      })).toThrow();
    });

    it('fileNameは255文字以下', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/test.png',
        fileName: 'a'.repeat(256),
      })).toThrow();
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
      expect(mockApiClient.postMultipart).not.toHaveBeenCalled();
    });

    it('filePathからファイルを読み取りpostMultipartで送信する（自動検出）', async () => {
      const mockResponse = {
        evidence: {
          id: '99999999-9999-9999-9999-999999999999',
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'screenshot.png',
          fileUrl: 'evidences/xxx/yyy/uuid_screenshot.png',
          fileType: 'image/png',
          fileSize: 100,
          description: null,
          uploadedByUserId: TEST_USER_ID,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.postMultipart.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      };

      const result = await uploadExecutionEvidenceTool.handler(input, context);

      // ファイルを読み取ったことを確認
      expect(mockFs.readFile).toHaveBeenCalledWith('/tmp/screenshot.png');

      // postMultipartが正しいパラメータで呼ばれたことを確認
      expect(mockApiClient.postMultipart).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}/evidences`,
        {
          file: {
            buffer: TEST_PNG_BUFFER,
            fileName: 'screenshot.png', // パスから自動検出
            mimeType: 'image/png', // 拡張子から自動検出
          },
          fields: {},
        },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('fileName/fileTypeを明示上書きできる', async () => {
      const mockResponse = {
        evidence: {
          id: '99999999-9999-9999-9999-999999999999',
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'custom_name.png',
          fileUrl: 'evidences/xxx/yyy/uuid_custom_name.png',
          fileType: 'image/jpeg',
          fileSize: 100,
          description: null,
          uploadedByUserId: TEST_USER_ID,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.postMultipart.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
        fileName: 'custom_name.png',
        fileType: 'image/jpeg',
      };

      await uploadExecutionEvidenceTool.handler(input, context);

      expect(mockApiClient.postMultipart).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          file: expect.objectContaining({
            fileName: 'custom_name.png',
            mimeType: 'image/jpeg',
          }),
        }),
        expect.any(Object)
      );
    });

    it('descriptionをfieldsとして送信する', async () => {
      mockApiClient.postMultipart.mockResolvedValueOnce({
        evidence: {
          id: '99999999-9999-9999-9999-999999999999',
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'screenshot.png',
          fileUrl: 'evidences/xxx/yyy/uuid_screenshot.png',
          fileType: 'image/png',
          fileSize: 100,
          description: 'テスト説明',
          uploadedByUserId: TEST_USER_ID,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
        description: 'テスト説明',
      };

      await uploadExecutionEvidenceTool.handler(input, context);

      expect(mockApiClient.postMultipart).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          fields: { description: 'テスト説明' },
        }),
        expect.any(Object)
      );
    });

    it('存在しないfilePathのエラーをわかりやすく返す', async () => {
      mockFs.stat.mockRejectedValueOnce(
        Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/nonexistent.png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'ファイルが見つかりません: /tmp/nonexistent.png'
      );
      expect(mockApiClient.postMultipart).not.toHaveBeenCalled();
    });

    it('アクセス権がないファイルのエラーをわかりやすく返す', async () => {
      mockFs.stat.mockRejectedValueOnce(
        Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/root/secret.png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'ファイルへのアクセス権がありません: /root/secret.png'
      );
      expect(mockApiClient.postMultipart).not.toHaveBeenCalled();
    });

    it('ファイルサイズが上限を超えた場合はエラーを返す', async () => {
      mockFs.stat.mockResolvedValueOnce({ size: 101 * 1024 * 1024 }); // 101MB

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/huge_video.mp4',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'ファイルサイズが上限（100MB）を超えています'
      );
      expect(mockFs.readFile).not.toHaveBeenCalled();
      expect(mockApiClient.postMultipart).not.toHaveBeenCalled();
    });

    it('拡張子からMIMEタイプを検出できない場合はapplication/octet-streamを使用', async () => {
      mockApiClient.postMultipart.mockResolvedValueOnce({
        evidence: {
          id: '99999999-9999-9999-9999-999999999999',
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'noext',
          fileUrl: 'evidences/xxx/yyy/uuid_noext',
          fileType: 'application/octet-stream',
          fileSize: 100,
          description: null,
          uploadedByUserId: TEST_USER_ID,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      });

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/noext',
      };

      await uploadExecutionEvidenceTool.handler(input, context);

      expect(mockApiClient.postMultipart).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          file: expect.objectContaining({
            mimeType: 'application/octet-stream',
          }),
        }),
        expect.any(Object)
      );
    });

    it('APIエラーを伝播する（403: 実行がIN_PROGRESS以外）', async () => {
      mockApiClient.postMultipart.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied or execution is not in progress')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied or execution is not in progress'
      );
    });

    it('APIエラーを伝播する（400: 不正なMIMEタイプ）', async () => {
      mockApiClient.postMultipart.mockRejectedValueOnce(
        new Error('Internal API error: 400 - 許可されていないファイル形式です')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/malicious.exe',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 400 - 許可されていないファイル形式です'
      );
    });

    it('APIエラーを伝播する（400: エビデンス上限）', async () => {
      mockApiClient.postMultipart.mockRejectedValueOnce(
        new Error('Internal API error: 400 - エビデンスの上限（10件）に達しています')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 400 - エビデンスの上限（10件）に達しています'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.postMultipart.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Expected result not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Expected result not found'
      );
    });
  });
});
