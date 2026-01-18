import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolContext } from '../../../tools/index.js';

// レスポンス型
interface SearchExecutionResponse {
  executions: Array<{
    id: string;
    testSuiteId: string;
    executedByUser: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
    environment: {
      id: string;
      name: string;
      slug: string;
    } | null;
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
import { searchExecutionTool, searchExecutionInputSchema } from '../../../tools/search-execution.js';

// テスト用の固定UUID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_EXECUTION_ID = '33333333-3333-3333-3333-333333333333';
const TEST_ENVIRONMENT_ID = '44444444-4444-4444-4444-444444444444';

// モックレスポンスを作成するヘルパー
function createMockResponse(executions: unknown[] = []) {
  return {
    executions,
    pagination: {
      total: executions.length,
      limit: 20,
      offset: 0,
      hasMore: false,
    },
  };
}

// モック実行履歴を作成するヘルパー
function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_EXECUTION_ID,
    testSuiteId: TEST_SUITE_ID,
    executedByUser: {
      id: TEST_USER_ID,
      name: 'Test User',
      avatarUrl: null,
    },
    environment: {
      id: TEST_ENVIRONMENT_ID,
      name: 'Production',
      slug: 'production',
    },
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T11:00:00.000Z',
    ...overrides,
  };
}

describe('searchExecutionTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ツール定義', () => {
    it('正しい名前と説明を持つ', () => {
      expect(searchExecutionTool.name).toBe('search_execution');
      expect(searchExecutionTool.description).toContain('テスト実行履歴を検索');
    });

    it('入力スキーマが定義されている', () => {
      expect(searchExecutionTool.inputSchema).toBeDefined();
    });
  });

  describe('入力スキーマ', () => {
    it('testSuiteIdは必須', () => {
      expect(() => searchExecutionInputSchema.parse({})).toThrow();
    });

    it('デフォルト値が設定される', () => {
      const result = searchExecutionInputSchema.parse({ testSuiteId: TEST_SUITE_ID });
      expect(result).toEqual({
        testSuiteId: TEST_SUITE_ID,
        from: undefined,
        to: undefined,
        limit: 20,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
    });

    it('日時フィルタを受け付ける', () => {
      const result = searchExecutionInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T23:59:59.999Z',
      });
      expect(result.from).toBe('2024-01-01T00:00:00.000Z');
      expect(result.to).toBe('2024-01-31T23:59:59.999Z');
    });

    it('ソート設定を受け付ける', () => {
      const result = searchExecutionInputSchema.parse({
        testSuiteId: TEST_SUITE_ID,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });
      expect(result.sortBy).toBe('createdAt');
      expect(result.sortOrder).toBe('asc');
    });

    it('limitが50を超えるとエラー', () => {
      expect(() => searchExecutionInputSchema.parse({ testSuiteId: TEST_SUITE_ID, limit: 51 })).toThrow();
    });

    it('limitが0以下だとエラー', () => {
      expect(() => searchExecutionInputSchema.parse({ testSuiteId: TEST_SUITE_ID, limit: 0 })).toThrow();
    });

    it('offsetが負の値だとエラー', () => {
      expect(() => searchExecutionInputSchema.parse({ testSuiteId: TEST_SUITE_ID, offset: -1 })).toThrow();
    });

    it('不正な日時形式はエラー', () => {
      expect(() => searchExecutionInputSchema.parse({ testSuiteId: TEST_SUITE_ID, from: 'invalid-date' })).toThrow();
    });

    it('不正なUUID形式のtestSuiteIdはエラー', () => {
      expect(() => searchExecutionInputSchema.parse({ testSuiteId: 'invalid-uuid' })).toThrow();
    });

    it('不正なsortByはエラー', () => {
      expect(() => searchExecutionInputSchema.parse({ testSuiteId: TEST_SUITE_ID, sortBy: 'invalid' })).toThrow();
    });
  });

  describe('ハンドラー', () => {
    it('認証されていない場合はエラーをスローする', async () => {
      const context: ToolContext = { userId: '' };
      const input = { testSuiteId: TEST_SUITE_ID, limit: 20, offset: 0, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

      await expect(searchExecutionTool.handler(input, context)).rejects.toThrow(
        '認証されていません'
      );
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('正常に内部APIを呼び出す', async () => {
      const mockExecution = createMockExecution();
      const mockResponse = createMockResponse([mockExecution]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, limit: 20, offset: 0, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

      const result = await searchExecutionTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/executions`,
        {
          userId: TEST_USER_ID,
          from: undefined,
          to: undefined,
          limit: 20,
          offset: 0,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('日時フィルタを渡す', async () => {
      mockApiClient.get.mockResolvedValueOnce(createMockResponse([]));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        from: '2024-01-01T00:00:00.000Z',
        to: '2024-01-31T23:59:59.999Z',
        limit: 10,
        offset: 5,
        sortBy: 'createdAt' as const,
        sortOrder: 'asc' as const,
      };

      await searchExecutionTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/executions`,
        {
          userId: TEST_USER_ID,
          from: '2024-01-01T00:00:00.000Z',
          to: '2024-01-31T23:59:59.999Z',
          limit: 10,
          offset: 5,
          sortBy: 'createdAt',
          sortOrder: 'asc',
        }
      );
    });

    it('APIエラーを伝播する', async () => {
      mockApiClient.get.mockRejectedValueOnce(
        new Error('Internal API error: 403 - Access denied')
      );

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, limit: 20, offset: 0, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

      await expect(searchExecutionTool.handler(input, context)).rejects.toThrow(
        'Internal API error: 403 - Access denied'
      );
    });

    it('複数の実行履歴を返す', async () => {
      const executions = [
        createMockExecution({ id: 'exec-1' }),
        createMockExecution({ id: 'exec-2' }),
        createMockExecution({ id: 'exec-3' }),
      ];
      const mockResponse = createMockResponse(executions);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, limit: 20, offset: 0, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

      const result = (await searchExecutionTool.handler(input, context)) as SearchExecutionResponse;

      expect(result.executions).toHaveLength(3);
      expect(result.pagination.total).toBe(3);
    });

    it('実行者がnullの実行履歴を返す', async () => {
      const executionWithoutUser = createMockExecution({
        executedByUser: null,
      });
      const mockResponse = createMockResponse([executionWithoutUser]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, limit: 20, offset: 0, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

      const result = (await searchExecutionTool.handler(input, context)) as SearchExecutionResponse;

      expect(result.executions[0].executedByUser).toBeNull();
    });

    it('環境がnullの実行履歴を返す', async () => {
      const executionWithoutEnv = createMockExecution({
        environment: null,
      });
      const mockResponse = createMockResponse([executionWithoutEnv]);
      mockApiClient.get.mockResolvedValueOnce(mockResponse);

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = { testSuiteId: TEST_SUITE_ID, limit: 20, offset: 0, sortBy: 'createdAt' as const, sortOrder: 'desc' as const };

      const result = (await searchExecutionTool.handler(input, context)) as SearchExecutionResponse;

      expect(result.executions[0].environment).toBeNull();
    });

    it('日時範囲フィルタのみを指定する', async () => {
      mockApiClient.get.mockResolvedValueOnce(createMockResponse([]));

      const context: ToolContext = { userId: TEST_USER_ID };
      const input = {
        testSuiteId: TEST_SUITE_ID,
        from: '2024-01-01T00:00:00.000Z',
        limit: 20,
        offset: 0,
        sortBy: 'createdAt' as const,
        sortOrder: 'desc' as const,
      };

      await searchExecutionTool.handler(input, context);

      expect(mockApiClient.get).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/executions`,
        expect.objectContaining({
          from: '2024-01-01T00:00:00.000Z',
          to: undefined,
        })
      );
    });
  });
});
