import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  post: vi.fn(),
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

// テスト用Base64データ（1x1ピクセルのPNG画像）
const TEST_BASE64_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('uploadExecutionEvidenceTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    it('有効な入力を受け付ける（description無し）', () => {
      const result = uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'screenshot.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      });
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
      expect(result.expectedResultId).toBe(TEST_EXPECTED_RESULT_ID);
      expect(result.fileName).toBe('screenshot.png');
      expect(result.fileType).toBe('image/png');
      expect(result.description).toBeUndefined();
    });

    it('有効な入力を受け付ける（description有り）', () => {
      const result = uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'error_screen.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
        description: 'エラー画面のスクリーンショット',
      });
      expect(result.fileName).toBe('error_screen.png');
      expect(result.description).toBe('エラー画面のスクリーンショット');
    });

    it('executionId, expectedResultId, fileName, fileData, fileTypeは必須', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({})).toThrow();
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
      })).toThrow();
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
      })).toThrow();
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'test.png',
      })).toThrow();
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'test.png',
        fileData: TEST_BASE64_PNG,
      })).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: 'invalid-uuid',
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'test.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      })).toThrow();

      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: 'invalid-uuid',
        fileName: 'test.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      })).toThrow();
    });

    it('fileNameは255文字以下', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'a'.repeat(256),
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      })).toThrow();
    });

    it('descriptionは2000文字以下', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'test.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
        description: 'a'.repeat(2001),
      })).toThrow();
    });

    it('空のfileNameはエラー', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: '',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      })).toThrow();
    });

    it('空のfileDataはエラー', () => {
      expect(() => uploadExecutionEvidenceInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'test.png',
        fileData: '',
        fileType: 'image/png',
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'screenshot.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.post).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す（description無し）', async () => {
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
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'screenshot.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      };

      const result = await uploadExecutionEvidenceTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}/evidences`,
        {
          fileName: 'screenshot.png',
          fileData: TEST_BASE64_PNG,
          fileType: 'image/png',
          description: undefined,
        },
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常に内部APIを呼び出す（description有り）', async () => {
      const mockResponse = {
        evidence: {
          id: '99999999-9999-9999-9999-999999999999',
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'error_screen.png',
          fileUrl: 'evidences/xxx/yyy/uuid_error_screen.png',
          fileType: 'image/png',
          fileSize: 100,
          description: 'エラー画面のスクリーンショット',
          uploadedByUserId: TEST_USER_ID,
          createdAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.post.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'error_screen.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
        description: 'エラー画面のスクリーンショット',
      };

      await uploadExecutionEvidenceTool.handler(input, context);

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}/evidences`,
        {
          fileName: 'error_screen.png',
          fileData: TEST_BASE64_PNG,
          fileType: 'image/png',
          description: 'エラー画面のスクリーンショット',
        },
        { userId: TEST_USER_ID }
      );
    });

    it('APIエラーを伝播する（403: 実行がIN_PROGRESS以外）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied or execution is not in progress')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'screenshot.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied or execution is not in progress'
      );
    });

    it('APIエラーを伝播する（400: 不正なMIMEタイプ）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 400 - 許可されていないファイル形式です')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'malicious.exe',
        fileData: TEST_BASE64_PNG,
        fileType: 'application/x-executable',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 400 - 許可されていないファイル形式です'
      );
    });

    it('APIエラーを伝播する（400: エビデンス上限）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 400 - エビデンスの上限（10件）に達しています')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'screenshot.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 400 - エビデンスの上限（10件）に達しています'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Expected result not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'screenshot.png',
        fileData: TEST_BASE64_PNG,
        fileType: 'image/png',
      };

      await expect(uploadExecutionEvidenceTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Expected result not found'
      );
    });
  });
});
