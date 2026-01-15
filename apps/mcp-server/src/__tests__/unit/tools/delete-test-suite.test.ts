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
import { deleteTestSuiteTool, deleteTestSuiteInputSchema } from '../../../tools/delete-test-suite.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';

describe('deleteTestSuiteTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLockStatus.mockResolvedValue(undefined);
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(deleteTestSuiteTool.name).toBe('delete_test_suite');
      expect(deleteTestSuiteTool.description).toContain('テストスイートを削除');
    });

    it('入力スキーマが定義されている', () => {
      expect(deleteTestSuiteTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('testSuiteIdのみで有効', () => {
      const result = deleteTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
      });
      expect(result.testSuiteId).toBe(TEST_SUITE_ID);
    });

    it('testSuiteIdは必須', () => {
      expect(() => deleteTestSuiteInputSchema.parse({})).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => deleteTestSuiteInputSchema.parse({
        testSuiteId: 'invalid-uuid',
      })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testSuiteId: TEST_SUITE_ID };

      await expect(deleteTestSuiteTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.delete).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockResponse = {
        success: true,
        deletedId: TEST_SUITE_ID,
      };
      mockApiClient.delete.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID };

      const result = await deleteTestSuiteTool.handler(input, context);

      expect(mockApiClient.delete).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}`,
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.delete.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID };

      await expect(deleteTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.delete.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test suite not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID };

      await expect(deleteTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test suite not found'
      );
    });
  });
});
