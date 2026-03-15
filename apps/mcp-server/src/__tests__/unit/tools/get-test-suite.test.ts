import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// モック設定後にインポート
import { getTestSuiteTool, getTestSuiteInputSchema } from '../../../tools/get-test-suite.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';

// モックテストスイートを作成するヘルパー
function createMockTestSuite(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_TEST_SUITE_ID,
    name: 'Test Suite',
    description: 'Test suite description',
    status: 'ACTIVE',
    projectId: TEST_PROJECT_ID,
    project: { id: TEST_PROJECT_ID, name: 'Test Project' },
    createdByUser: { id: TEST_USER_ID, name: 'Test User', avatarUrl: null },
    preconditions: [],
    testCases: [],
    _count: { testCases: 0, preconditions: 0 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getTestSuiteTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(getTestSuiteTool.name).toBe('get_test_suite');
      expect(getTestSuiteTool.description).toContain('テストスイートの詳細情報を取得');
    });

    it('入力スキーマが定義されている', () => {
      expect(getTestSuiteTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効なUUIDを受け付ける', () => {
      const result = getTestSuiteInputSchema.parse({ testSuiteId: TEST_TEST_SUITE_ID });
      expect(result.testSuiteId).toBe(TEST_TEST_SUITE_ID);
    });

    it('testSuiteIdが必須', () => {
      expect(() => getTestSuiteInputSchema.parse({})).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => getTestSuiteInputSchema.parse({ testSuiteId: 'invalid-uuid' })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testSuiteId: TEST_TEST_SUITE_ID };

      await expect(getTestSuiteTool.handler(input, context)).rejects.toThrow('認証されていません');
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockTestSuite = createMockTestSuite();
      const mockResponse = { testSuite: mockTestSuite };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_TEST_SUITE_ID };

      const result = await getTestSuiteTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_TEST_SUITE_ID}`,
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('前提条件とテストケースを含むテストスイートを返す', async () => {
      const testSuiteWithData = createMockTestSuite({
        preconditions: [{ id: 'precond-1', content: 'Precondition 1', orderKey: '00001' }],
        testCases: [
          {
            id: 'tc-1',
            title: 'Test Case 1',
            priority: 'HIGH',
            status: 'ACTIVE',
            _count: { preconditions: 0, steps: 2, expectedResults: 1 },
          },
        ],
        _count: { testCases: 1, preconditions: 1 },
      });
      const mockResponse = { testSuite: testSuiteWithData };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_TEST_SUITE_ID };

      const result = await getTestSuiteTool.handler(input, context);

      const typedResult = result as {
        testSuite: { preconditions: unknown[]; testCases: unknown[] };
      };
      expect(typedResult.testSuite.preconditions).toHaveLength(1);
      expect(typedResult.testSuite.testCases).toHaveLength(1);
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.get.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test suite not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_TEST_SUITE_ID };

      await expect(getTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test suite not found'
      );
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Internal API error: 403 - Access denied'));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_TEST_SUITE_ID };

      await expect(getTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });
  });
});
