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
import { getTestCaseTool, getTestCaseInputSchema } from '../../../tools/get-test-case.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_TEST_CASE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';

// モックテストケースを作成するヘルパー
function createMockTestCase(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_TEST_CASE_ID,
    testSuiteId: TEST_TEST_SUITE_ID,
    testSuite: { id: TEST_TEST_SUITE_ID, name: 'Test Suite', projectId: TEST_PROJECT_ID },
    title: 'Test Case',
    description: 'Test case description',
    priority: 'HIGH',
    status: 'ACTIVE',
    orderKey: '00001',
    createdByUser: { id: TEST_USER_ID, name: 'Test User', avatarUrl: null },
    preconditions: [],
    steps: [],
    expectedResults: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('getTestCaseTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(getTestCaseTool.name).toBe('get_test_case');
      expect(getTestCaseTool.description).toContain('テストケースの詳細情報を取得');
    });

    it('入力スキーマが定義されている', () => {
      expect(getTestCaseTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('有効なUUIDを受け付ける', () => {
      const result = getTestCaseInputSchema.parse({ testCaseId: TEST_TEST_CASE_ID });
      expect(result.testCaseId).toBe(TEST_TEST_CASE_ID);
    });

    it('testCaseIdが必須', () => {
      expect(() => getTestCaseInputSchema.parse({})).toThrow();
    });

    it('無効なUUIDはエラー', () => {
      expect(() => getTestCaseInputSchema.parse({ testCaseId: 'invalid-uuid' })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testCaseId: TEST_TEST_CASE_ID };

      await expect(getTestCaseTool.handler(input, context)).rejects.toThrow('認証されていません');
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockTestCase = createMockTestCase();
      const mockResponse = { testCase: mockTestCase };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_TEST_CASE_ID };

      const result = await getTestCaseTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/test-cases/${TEST_TEST_CASE_ID}`,
        { userId: TEST_USER_ID }
      );
      expect(result).toEqual(mockResponse);
    });

    it('前提条件、ステップ、期待結果を含むテストケースを返す', async () => {
      const testCaseWithData = createMockTestCase({
        preconditions: [{ id: 'precond-1', content: 'Precondition 1', orderKey: '00001' }],
        steps: [
          { id: 'step-1', content: 'Step 1', orderKey: '00001' },
          { id: 'step-2', content: 'Step 2', orderKey: '00002' },
        ],
        expectedResults: [{ id: 'result-1', content: 'Expected Result 1', orderKey: '00001' }],
      });
      const mockResponse = { testCase: testCaseWithData };
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_TEST_CASE_ID };

      const result = await getTestCaseTool.handler(input, context);

      const typedResult = result as {
        testCase: { preconditions: unknown[]; steps: unknown[]; expectedResults: unknown[] };
      };
      expect(typedResult.testCase.preconditions).toHaveLength(1);
      expect(typedResult.testCase.steps).toHaveLength(2);
      expect(typedResult.testCase.expectedResults).toHaveLength(1);
    });

    it('APIエラーを伝播する（404）', async () => {
      mockApiClient.get.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test case not found')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_TEST_CASE_ID };

      await expect(getTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 404 - Test case not found'
      );
    });

    it('APIエラーを伝播する（403）', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Internal API error: 403 - Access denied'));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testCaseId: TEST_TEST_CASE_ID };

      await expect(getTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });
  });
});
