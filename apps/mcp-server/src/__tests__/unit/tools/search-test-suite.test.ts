import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// レスポンス型
interface SearchTestSuiteResponse {
  testSuites: Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    projectId: string;
    project: {
      id: string;
      name: string;
    };
    createdByUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    _count: {
      testCases: number;
      preconditions: number;
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
import {
  searchTestSuiteTool,
  searchTestSuiteInputSchema,
} from '../../../tools/search-test-suite.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';

// モックレスポンスを作成するヘルパー
function createMockResponse(testSuites: unknown[] = []) {
  return {
    testSuites,
    pagination: {
      total: testSuites.length,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  };
}

// モックテストスイートを作成するヘルパー
function createMockTestSuite(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_SUITE_ID,
    name: 'Test Suite',
    description: 'Test description',
    status: 'ACTIVE',
    projectId: TEST_PROJECT_ID,
    project: {
      id: TEST_PROJECT_ID,
      name: 'Test Project',
    },
    createdByUser: {
      id: TEST_USER_ID,
      name: 'Test User',
      avatarUrl: null,
    },
    _count: { testCases: 10, preconditions: 2 },
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('searchTestSuiteTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(searchTestSuiteTool.name).toBe('search_test_suite');
      expect(searchTestSuiteTool.description).toContain('テストスイート一覧を検索');
    });

    it('入力スキーマが定義されている', () => {
      expect(searchTestSuiteTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('デフォルト値が設定される', () => {
      const result = searchTestSuiteInputSchema.parse({});
      expect(result).toEqual({
        projectId: undefined,
        q: undefined,
        status: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it('検索クエリを受け付ける', () => {
      const result = searchTestSuiteInputSchema.parse({ q: 'test' });
      expect(result.q).toBe('test');
    });

    it('プロジェクトIDを受け付ける', () => {
      const result = searchTestSuiteInputSchema.parse({ projectId: TEST_PROJECT_ID });
      expect(result.projectId).toBe(TEST_PROJECT_ID);
    });

    it('ステータスを受け付ける', () => {
      const result = searchTestSuiteInputSchema.parse({ status: 'ACTIVE' });
      expect(result.status).toBe('ACTIVE');
    });

    it('limitとoffsetをオーバーライドできる', () => {
      const result = searchTestSuiteInputSchema.parse({ limit: 10, offset: 20 });
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
    });

    it('qが100文字を超えるとエラー', () => {
      const longQuery = 'a'.repeat(101);
      expect(() => searchTestSuiteInputSchema.parse({ q: longQuery })).toThrow();
    });

    it('limitが50を超えるとエラー', () => {
      expect(() => searchTestSuiteInputSchema.parse({ limit: 51 })).toThrow();
    });

    it('limitが0以下だとエラー', () => {
      expect(() => searchTestSuiteInputSchema.parse({ limit: 0 })).toThrow();
    });

    it('offsetが負の値だとエラー', () => {
      expect(() => searchTestSuiteInputSchema.parse({ offset: -1 })).toThrow();
    });

    it('不正なステータスはエラー', () => {
      expect(() => searchTestSuiteInputSchema.parse({ status: 'INVALID' })).toThrow();
    });

    it('不正なUUID形式のprojectIdはエラー', () => {
      expect(() => searchTestSuiteInputSchema.parse({ projectId: 'invalid-uuid' })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { limit: 20, offset: 0 };

      await expect(searchTestSuiteTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockTestSuite = createMockTestSuite();
      const mockResponse = createMockResponse([mockTestSuite]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 20, offset: 0 };

      const result = await searchTestSuiteTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/users/${TEST_USER_ID}/test-suites`,
        {
          projectId: undefined,
          q: undefined,
          status: undefined,
          limit: 20,
          offset: 0,
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('検索クエリを渡す', async () => {
      mockApiClient.get.mockResolvedValueOnce(createMockResponse([]));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { q: 'search-term', limit: 10, offset: 5 };

      await searchTestSuiteTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/users/${TEST_USER_ID}/test-suites`,
        {
          projectId: undefined,
          q: 'search-term',
          status: undefined,
          limit: 10,
          offset: 5,
        }
      );
    });

    it('プロジェクトIDとステータスを渡す', async () => {
      mockApiClient.get.mockResolvedValueOnce(createMockResponse([]));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { projectId: TEST_PROJECT_ID, status: 'DRAFT' as const, limit: 20, offset: 0 };

      await searchTestSuiteTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/users/${TEST_USER_ID}/test-suites`,
        {
          projectId: TEST_PROJECT_ID,
          q: undefined,
          status: 'DRAFT',
          limit: 20,
          offset: 0,
        }
      );
    });

    it('APIエラーを伝播する', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('Internal API error: 500 - Server error'));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 20, offset: 0 };

      await expect(searchTestSuiteTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 500 - Server error'
      );
    });

    it('複数のテストスイートを返す', async () => {
      const testSuites = [
        createMockTestSuite({ id: 'suite-1', name: 'Suite 1' }),
        createMockTestSuite({ id: 'suite-2', name: 'Suite 2' }),
        createMockTestSuite({ id: 'suite-3', name: 'Suite 3' }),
      ];
      const mockResponse = createMockResponse(testSuites);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 20, offset: 0 };

      const result = (await searchTestSuiteTool.handler(input, context)) as SearchTestSuiteResponse;

      expect(result.testSuites).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it('作成者がnullのテストスイートを返す', async () => {
      const testSuiteWithoutCreator = createMockTestSuite({
        createdByUser: null,
      });
      const mockResponse = createMockResponse([testSuiteWithoutCreator]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { limit: 20, offset: 0 };

      const result = (await searchTestSuiteTool.handler(input, context)) as SearchTestSuiteResponse;

      expect(result.testSuites[0].createdByUser).toBeNull();
    });

    it('異なるステータスのテストスイートを返す', async () => {
      const draftSuite = createMockTestSuite({ status: 'DRAFT' });
      const mockResponse = createMockResponse([draftSuite]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { status: 'DRAFT' as const, limit: 20, offset: 0 };

      const result = (await searchTestSuiteTool.handler(input, context)) as SearchTestSuiteResponse;

      expect(result.testSuites[0].status).toBe('DRAFT');
    });
  });
});
