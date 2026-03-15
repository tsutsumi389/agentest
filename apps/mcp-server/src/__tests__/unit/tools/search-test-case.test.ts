import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// レスポンス型
interface SearchTestCaseResponse {
  testCases: Array<{
    id: string;
    testSuiteId: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    orderKey: string;
    createdByUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    _count: {
      preconditions: number;
      steps: number;
      expectedResults: number;
    };
    createdAt: string;
    updatedAt: string;
  }>;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// apiClientのモック
const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock('../../../clients/api-client.js', () => ({
  apiClient: mockApiClient,
}));

// モック設定後にインポート
import { searchTestCaseTool, searchTestCaseInputSchema } from '../../../tools/search-test-case.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_CASE_ID = '33333333-3333-3333-3333-333333333333';

// モックレスポンスを作成するヘルパー
function createMockResponse(testCases: unknown[] = []) {
  return {
    testCases,
    pagination: {
      total: testCases.length,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  };
}

// モックテストケースを作成するヘルパー
function createMockTestCase(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_CASE_ID,
    testSuiteId: TEST_SUITE_ID,
    title: 'Test Case',
    description: 'Test description',
    status: 'ACTIVE',
    priority: 'MEDIUM',
    orderKey: '00001',
    createdByUser: {
      id: TEST_USER_ID,
      name: 'Test User',
      avatarUrl: null,
    },
    _count: { preconditions: 1, steps: 3, expectedResults: 2 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('searchTestCaseTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(searchTestCaseTool.name).toBe('search_test_case');
      expect(searchTestCaseTool.description).toContain('テストケース一覧を検索');
    });

    it('入力スキーマが定義されている', () => {
      expect(searchTestCaseTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('testSuiteIdは必須', () => {
      expect(() => searchTestCaseInputSchema.parse({})).toThrow();
    });

    it('デフォルト値が設定される', () => {
      const result = searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID });
      expect(result).toEqual({
        testSuiteId: TEST_SUITE_ID,
        q: undefined,
        status: undefined,
        priority: undefined,
        limit: 20,
        offset: 0,
        sortBy: 'orderKey',
        sortOrder: 'asc',
      });
    });

    it('検索クエリを受け付ける', () => {
      const result = searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID, q: 'test' });
      expect(result.q).toBe('test');
    });

    it('ステータス配列を受け付ける', () => {
      const result = searchTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        status: ['DRAFT', 'ACTIVE'],
      });
      expect(result.status).toEqual(['DRAFT', 'ACTIVE']);
    });

    it('優先度配列を受け付ける', () => {
      const result = searchTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        priority: ['HIGH', 'CRITICAL'],
      });
      expect(result.priority).toEqual(['HIGH', 'CRITICAL']);
    });

    it('ソート設定を受け付ける', () => {
      const result = searchTestCaseInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        sortBy: 'priority',
        sortOrder: 'desc',
      });
      expect(result.sortBy).toBe('priority');
      expect(result.sortOrder).toBe('desc');
    });

    it('qが100文字を超えるとエラー', () => {
      const longQuery = 'a'.repeat(101);
      expect(() =>
        searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID, q: longQuery })
      ).toThrow();
    });

    it('limitが50を超えるとエラー', () => {
      expect(() =>
        searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID, limit: 51 })
      ).toThrow();
    });

    it('limitが0以下だとエラー', () => {
      expect(() =>
        searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID, limit: 0 })
      ).toThrow();
    });

    it('offsetが負の値だとエラー', () => {
      expect(() =>
        searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID, offset: -1 })
      ).toThrow();
    });

    it('不正なステータスはエラー', () => {
      expect(() =>
        searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID, status: ['INVALID'] })
      ).toThrow();
    });

    it('不正な優先度はエラー', () => {
      expect(() =>
        searchTestCaseInputSchema.parse({ testSuiteId: TEST_SUITE_ID, priority: ['INVALID'] })
      ).toThrow();
    });

    it('不正なUUID形式のtestSuiteIdはエラー', () => {
      expect(() => searchTestCaseInputSchema.parse({ testSuiteId: 'invalid-uuid' })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        limit: 20,
        offset: 0,
        sortBy: 'orderKey' as const,
        sortOrder: 'asc' as const,
      };

      await expect(searchTestCaseTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockTestCase = createMockTestCase();
      const mockResponse = createMockResponse([mockTestCase]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        limit: 20,
        offset: 0,
        sortBy: 'orderKey' as const,
        sortOrder: 'asc' as const,
      };

      const result = await searchTestCaseTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/test-cases`,
        {
          userId: TEST_USER_ID,
          q: undefined,
          status: undefined,
          priority: undefined,
          limit: 20,
          offset: 0,
          sortBy: 'orderKey',
          sortOrder: 'asc',
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('検索クエリとフィルタを渡す', async () => {
      mockApiClient.get.mockResolvedValueOnce(createMockResponse([]));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        q: 'search-term',
        status: ['ACTIVE'] as ('DRAFT' | 'ACTIVE' | 'ARCHIVED')[],
        priority: ['HIGH', 'CRITICAL'] as ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[],
        limit: 10,
        offset: 5,
        sortBy: 'priority' as const,
        sortOrder: 'desc' as const,
      };

      await searchTestCaseTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/test-cases`,
        {
          userId: TEST_USER_ID,
          q: 'search-term',
          status: ['ACTIVE'],
          priority: ['HIGH', 'CRITICAL'],
          limit: 10,
          offset: 5,
          sortBy: 'priority',
          sortOrder: 'desc',
        }
      );
    });

    it('APIエラーを伝播する', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Internal API error: 403 - Access denied'));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        limit: 20,
        offset: 0,
        sortBy: 'orderKey' as const,
        sortOrder: 'asc' as const,
      };

      await expect(searchTestCaseTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('複数のテストケースを返す', async () => {
      const testCases = [
        createMockTestCase({ id: 'case-1', title: 'Case 1' }),
        createMockTestCase({ id: 'case-2', title: 'Case 2' }),
        createMockTestCase({ id: 'case-3', title: 'Case 3' }),
      ];
      const mockResponse = createMockResponse(testCases);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        limit: 20,
        offset: 0,
        sortBy: 'orderKey' as const,
        sortOrder: 'asc' as const,
      };

      const result = (await searchTestCaseTool.handler(input, context)) as SearchTestCaseResponse;

      expect(result.testCases).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it('作成者がnullのテストケースを返す', async () => {
      const testCaseWithoutCreator = createMockTestCase({
        createdByUser: null,
      });
      const mockResponse = createMockResponse([testCaseWithoutCreator]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        limit: 20,
        offset: 0,
        sortBy: 'orderKey' as const,
        sortOrder: 'asc' as const,
      };

      const result = (await searchTestCaseTool.handler(input, context)) as SearchTestCaseResponse;

      expect(result.testCases[0].createdByUser).toBeNull();
    });

    it('異なる優先度のテストケースを返す', async () => {
      const criticalCase = createMockTestCase({ priority: 'CRITICAL' });
      const mockResponse = createMockResponse([criticalCase]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        priority: ['CRITICAL'] as ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[],
        limit: 20,
        offset: 0,
        sortBy: 'orderKey' as const,
        sortOrder: 'asc' as const,
      };

      const result = (await searchTestCaseTool.handler(input, context)) as SearchTestCaseResponse;

      expect(result.testCases[0].priority).toBe('CRITICAL');
    });
  });
});
