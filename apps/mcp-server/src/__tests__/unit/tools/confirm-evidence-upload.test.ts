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
  confirmEvidenceUploadTool,
  confirmEvidenceUploadInputSchema,
} from '../../../tools/confirm-evidence-upload.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const TEST_EVIDENCE_ID = '99999999-9999-9999-9999-999999999999';

describe('confirmEvidenceUploadTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(confirmEvidenceUploadTool.name).toBe('confirm_evidence_upload');
      expect(confirmEvidenceUploadTool.description).toContain('アップロード完了');
    });
  });

  describe('入力スキーマ', () => {
    it('executionIdとevidenceIdが必須', () => {
      const result = confirmEvidenceUploadInputSchema.parse({
        executionId: TEST_EXECUTION_ID,
        evidenceId: TEST_EVIDENCE_ID,
      });
      expect(result.executionId).toBe(TEST_EXECUTION_ID);
      expect(result.evidenceId).toBe(TEST_EVIDENCE_ID);
    });

    it('フィールドが不足している場合はエラー', () => {
      expect(() => confirmEvidenceUploadInputSchema.parse({})).toThrow();
      expect(() =>
        confirmEvidenceUploadInputSchema.parse({
          executionId: TEST_EXECUTION_ID,
        })
      ).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() =>
        confirmEvidenceUploadInputSchema.parse({
          executionId: 'invalid',
          evidenceId: TEST_EVIDENCE_ID,
        })
      ).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        executionId: TEST_EXECUTION_ID,
        evidenceId: TEST_EVIDENCE_ID,
      };

      await expect(confirmEvidenceUploadTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
    });

    it('confirmエンドポイントを呼び出してファイルサイズを返す', async () => {
      mockApiClient.post.mockResolvedValueOnce({
        evidenceId: TEST_EVIDENCE_ID,
        fileSize: 12345,
      });

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        evidenceId: TEST_EVIDENCE_ID,
      };

      const result = (await confirmEvidenceUploadTool.handler(input, context)) as Record<
        string,
        unknown
      >;

      expect(mockApiClient.post).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/evidences/${TEST_EVIDENCE_ID}/confirm`,
        {},
        { userId: TEST_USER_ID }
      );
      expect(result).toHaveProperty('evidenceId', TEST_EVIDENCE_ID);
      expect(result).toHaveProperty('fileSize', 12345);
    });

    it('APIエラーを伝播する', async () => {
      mockApiClient.post.mockRejectedValueOnce(
        new Error('Internal API error: 400 - ファイルがアップロードされていません')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        executionId: TEST_EXECUTION_ID,
        evidenceId: TEST_EVIDENCE_ID,
      };

      await expect(confirmEvidenceUploadTool.handler(input, context)).rejects.toThrow(
        'ファイルがアップロードされていません'
      );
    });
  });
});
