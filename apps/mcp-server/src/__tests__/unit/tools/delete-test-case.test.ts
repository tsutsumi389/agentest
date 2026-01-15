import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  delete: vi.fn(),
}));

const mockCheckLockStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
  checkLockStatus: mockCheckLockStatus,
}));

// モック設定後にインポート
import { deleteTestCaseTool, deleteTestCaseInputSchema } from '../../../tools/delete-test-case.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CASE_ID = '44444444-4444-4444-4444-444444444444';

describe('deleteTestCaseTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLockStatus.mockResolvedValue(undefined);
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(deleteTestCaseTool.name).toBe('delete_test_case');
      expect(deleteTestCaseTool.description).toContain('テストケースを削除');
    });

    it('入力スキーマが定義されている', () => {
      expect(deleteTestCaseTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('testCaseIdのみで有効', () => {
      const result = deleteTestCaseInputSchema.parse({
        testCaseId: TEST_CASE_ID,
      });
      expect(result.testCaseId).toBe(TEST_CASE_ID);
    });

    it('testCaseIdは必須', () => {
      expect(() => deleteTestCaseInputSchema.parse({})).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => deleteTestCaseInputSchema.parse({
        testCaseId: 'invalid-uuid',
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testCaseId: TEST_CASE_ID };

      await expect(deleteTestCaseTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.delete).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockResponse = {
        success: true,
        deletedId: TEST_CASE_ID,
      };
      mockApiClient.delete.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_CASE_ID };

      const result = await deleteTestCaseTool.handler(input, context);

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        `/internal/api/test-cases/${TEST_CASE_ID}`,
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.delete.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_CASE_ID };

      await expect(deleteTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.delete.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test case not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_CASE_ID };

      await expect(deleteTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test case not found'
      );
    });
  });
});
