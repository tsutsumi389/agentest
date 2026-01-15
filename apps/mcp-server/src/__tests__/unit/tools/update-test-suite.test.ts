import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  patch: vi.fn(),
}));

const mockCheckLockStatus = vi.hoisted(() => vi.fn());

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
  checkLockStatus: mockCheckLockStatus,
}));

// モック設定後にインポート
import { updateTestSuiteTool, updateTestSuiteInputSchema } from '../../../tools/update-test-suite.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';

describe('updateTestSuiteTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckLockStatus.mockResolvedValue(undefined);
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(updateTestSuiteTool.name).toBe('update_test_suite');
      expect(updateTestSuiteTool.description).toContain('テストスイートの情報を更新');
    });

    it('入力スキーマが定義されている', () => {
      expect(updateTestSuiteTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('testSuiteIdのみで有効（更新フィールドは任意）', () => {
      const result = updateTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        name: 'Updated Suite',
      });
      expect(result.testSuiteId).toBe(TEST_SUITE_ID);
      expect(result.name).toBe('Updated Suite');
    });

    it('testSuiteIdは必須', () => {
      expect(() => updateTestSuiteInputSchema.parse({})).toThrow();
      expect(() => updateTestSuiteInputSchema.parse({ name: 'Test' })).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => updateTestSuiteInputSchema.parse({
        testSuiteId: 'invalid-uuid',
        name: 'Test Suite',
      })).toThrow();
    });

    it('nameは1-200文字', () => {
      expect(() => updateTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        name: '',
      })).toThrow();

      expect(() => updateTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        name: 'a'.repeat(201),
      })).toThrow();
    });

    it('descriptionは2000文字以下', () => {
      expect(() => updateTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        description: 'a'.repeat(2001),
      })).toThrow();
    });

    it('descriptionはnullを許容', () => {
      const result = updateTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        description: null,
      });
      expect(result.description).toBeNull();
    });

    it('無効なstatusはエラー', () => {
      expect(() => updateTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        status: 'INVALID',
      })).toThrow();
    });

    it('有効なstatusを受け付ける', () => {
      const result = updateTestSuiteInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        status: 'ACTIVE',
      });
      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testSuiteId: TEST_SUITE_ID, name: 'Updated Suite' };

      await expect(updateTestSuiteTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.patch).not.toHaveBeenCalled();
    });

    it('更新フィールドが0個の場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID };

      await expect(updateTestSuiteTool.handler(input, context)).rejects.toThrow(
        '少なくとも1つの更新フィールドを指定してください'
      );
      expect(mockApiClient.patch).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す（name更新）', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: '22222222-2222-2222-2222-222222222222',
          name: 'Updated Suite',
          description: 'Description',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, name: 'Updated Suite' };

      const result = await updateTestSuiteTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}`,
        expect.objectContaining({ name: 'Updated Suite', groupId: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('正常に内部APIを呼び出す（複数フィールド更新）', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: '22222222-2222-2222-2222-222222222222',
          name: 'Updated Suite',
          description: 'New Description',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        name: 'Updated Suite',
        description: 'New Description',
        status: 'ACTIVE' as const,
      };

      await updateTestSuiteTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}`,
        expect.objectContaining({ name: 'Updated Suite', description: 'New Description', status: 'ACTIVE', groupId: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
        { userId: TEST_USER_ID }
      );
    });

    it('descriptionをnullで更新できる', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: '22222222-2222-2222-2222-222222222222',
          name: 'Suite',
          description: null,
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };
      mockApiClient.patch.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, description: null };

      await updateTestSuiteTool.handler(input, context);

      expect(mockApiClient.patch).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}`,
        expect.objectContaining({ description: null, groupId: expect.stringMatching(/^[0-9a-f-]{36}$/) }),
        { userId: TEST_USER_ID }
      );
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, name: 'Updated Suite' };

      await expect(updateTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.patch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test suite not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, name: 'Updated Suite' };

      await expect(updateTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test suite not found'
      );
    });
  });
});
