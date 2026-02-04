import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  cleanupTestData,
  createTestAuthUser,
  createProjectSearchResponse,
  createTestSuiteSearchResponse,
  createTestCaseSearchResponse,
  createExecutionSearchResponse,
  createEmptyResponse,
  createMcpInitializeRequest,
  createMcpToolCallRequest,
  parseToolResultJson as parseToolResult,
  isToolError,
  getToolErrorMessage,
  initializeMcpSession,
  callMcpTool,
} from './mcp-tools-helpers.js';
import { createApp } from '../../app.js';

// --- グローバルなモック状態 ---

/** 認証済みユーザー情報（モック用） */
let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  deletedAt: Date | null;
} | null = null;

/** verifyAccessTokenの戻り値（モック用） */
let mockVerifyAccessTokenResult: { sub: string; email: string } | null = null;

/** verifyAccessTokenのエラー（モック用） */
let mockVerifyAccessTokenError: Error | null = null;

/** apiClient.getのモック応答マップ（パス部分一致 → レスポンス） */
let mockApiResponses: Record<string, unknown> = {};

/** apiClient.getでエラーを投げるかどうか */
let mockApiError: Error | null = null;

// --- モジュールモック ---

// 認証モック
vi.mock('@agentest/auth', () => ({
  verifyAccessToken: vi.fn().mockImplementation(() => {
    if (mockVerifyAccessTokenError) {
      throw mockVerifyAccessTokenError;
    }
    return mockVerifyAccessTokenResult;
  }),
}));

// Prisma userモック（認証ミドルウェア内でユーザー検索に使用）
vi.mock('@agentest/db', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const original = await importOriginal<typeof import('@agentest/db')>();
  return {
    ...original,
    prisma: {
      ...original.prisma,
      user: {
        ...original.prisma.user,
        findUnique: vi.fn().mockImplementation(async (args: { where: { id: string } }) => {
          if (mockAuthUser && args.where.id === mockAuthUser.id) {
            return mockAuthUser;
          }
          return original.prisma.user.findUnique(args);
        }),
      },
    },
  };
});

// apiClientモック（ツール内部でHTTPリクエストを送信する代わりにモックデータを返す）
vi.mock('../../clients/api-client.js', () => ({
  apiClient: {
    get: vi.fn().mockImplementation(async (path: string) => {
      if (mockApiError) {
        throw mockApiError;
      }
      // パスに部分一致するキーを探す
      const matchedKey = Object.keys(mockApiResponses).find((key) => path.includes(key));
      if (matchedKey) {
        return mockApiResponses[matchedKey];
      }
      // デフォルトの空レスポンス
      return { data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } };
    }),
    post: vi.fn().mockImplementation(async () => ({})),
    patch: vi.fn().mockImplementation(async () => ({})),
    delete: vi.fn().mockImplementation(async () => ({})),
  },
  InternalApiClient: vi.fn(),
}));

// --- ヘルパー関数 ---

/**
 * 認証状態を設定
 */
function setTestAuth(
  user: typeof mockAuthUser,
  tokenPayload?: { sub: string; email: string }
) {
  mockAuthUser = user;
  mockVerifyAccessTokenResult =
    tokenPayload ?? (user ? { sub: user.id, email: user.email } : null);
  mockVerifyAccessTokenError = null;
}

/**
 * 認証エラーを設定
 */
function setAuthError(error: Error) {
  mockAuthUser = null;
  mockVerifyAccessTokenResult = null;
  mockVerifyAccessTokenError = error;
}

/**
 * 認証状態をクリア
 */
function clearTestAuth() {
  mockAuthUser = null;
  mockVerifyAccessTokenResult = null;
  mockVerifyAccessTokenError = null;
}

/**
 * apiClientのモックレスポンスを設定
 */
function setApiResponses(responses: Record<string, unknown>) {
  mockApiResponses = responses;
  mockApiError = null;
}

/**
 * apiClientがエラーを返すように設定
 */
function setApiError(message: string, statusCode: number = 500) {
  mockApiError = new Error(`Internal API error: ${statusCode} - ${message}`);
}

/**
 * apiClientのモック状態をクリア
 */
function clearApiMock() {
  mockApiResponses = {};
  mockApiError = null;
}

// --- テスト本体 ---

describe('MCP検索ツール統合テスト', () => {
  let app: Express;
  let sessionId: string;
  const testUser = createTestAuthUser();

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    clearTestAuth();
    clearApiMock();

    // デフォルトの認証状態を設定
    setTestAuth(testUser);

    // 各テストでセッションを初期化
    sessionId = await initializeMcpSession(app);
  });

  // ===========================================
  // search_project ツールのテスト
  // ===========================================
  describe('search_project ツール', () => {
    it('プロジェクト一覧を正常に取得できる', async () => {
      const mockResponse = createProjectSearchResponse();
      setApiResponses({ '/projects': mockResponse });

      const response = await callMcpTool(app, sessionId, 'search_project', {});

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createProjectSearchResponse>;
      expect(result.projects).toHaveLength(2);
      expect(result.projects[0].id).toBe('proj-001');
      expect(result.projects[0].name).toBe('テストプロジェクト1');
      expect(result.pagination.total).toBe(2);
    });

    it('キーワードでプロジェクトを検索できる', async () => {
      const filteredResponse = createProjectSearchResponse({
        projects: [
          {
            id: 'proj-001',
            name: 'テストプロジェクト1',
            description: 'キーワードに一致するプロジェクト',
            organizationId: null,
            organization: null,
            role: 'OWNER',
            _count: { testSuites: 3 },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        total: 1,
      });
      setApiResponses({ '/projects': filteredResponse });

      const response = await callMcpTool(app, sessionId, 'search_project', {
        q: 'テスト',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createProjectSearchResponse>;
      expect(result.projects).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it('ページネーションパラメータを指定して取得できる', async () => {
      const pagedResponse = createProjectSearchResponse({
        projects: [
          {
            id: 'proj-003',
            name: 'ページ2のプロジェクト',
            description: null,
            organizationId: null,
            organization: null,
            role: 'VIEWER',
            _count: { testSuites: 0 },
            createdAt: '2024-02-01T00:00:00.000Z',
            updatedAt: '2024-02-01T00:00:00.000Z',
          },
        ],
        total: 3,
        limit: 1,
        offset: 2,
        hasMore: false,
      });
      setApiResponses({ '/projects': pagedResponse });

      const response = await callMcpTool(app, sessionId, 'search_project', {
        limit: 1,
        offset: 2,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createProjectSearchResponse>;
      expect(result.projects).toHaveLength(1);
      expect(result.pagination.limit).toBe(1);
      expect(result.pagination.offset).toBe(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.hasMore).toBe(false);
    });

    it('検索結果が空の場合、空配列が返る', async () => {
      const emptyResponse = createEmptyResponse('projects', 50);
      setApiResponses({ '/projects': emptyResponse });

      const response = await callMcpTool(app, sessionId, 'search_project', {
        q: '存在しないプロジェクト名',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as { projects: unknown[]; pagination: { total: number } };
      expect(result.projects).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it('hasMoreがtrueの場合、次のページが存在することを示す', async () => {
      const responseWithMore = createProjectSearchResponse({
        total: 100,
        limit: 10,
        offset: 0,
        hasMore: true,
      });
      setApiResponses({ '/projects': responseWithMore });

      const response = await callMcpTool(app, sessionId, 'search_project', {
        limit: 10,
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response) as ReturnType<typeof createProjectSearchResponse>;
      expect(result.pagination.hasMore).toBe(true);
      expect(result.pagination.total).toBe(100);
    });
  });

  // ===========================================
  // search_test_suite ツールのテスト
  // ===========================================
  describe('search_test_suite ツール', () => {
    it('テストスイート一覧を正常に取得できる', async () => {
      const mockResponse = createTestSuiteSearchResponse();
      setApiResponses({ '/test-suites': mockResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_suite', {});

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createTestSuiteSearchResponse>;
      expect(result.testSuites).toHaveLength(1);
      expect(result.testSuites[0].id).toBe('suite-001');
      expect(result.testSuites[0].name).toBe('ログインテストスイート');
      expect(result.testSuites[0].status).toBe('ACTIVE');
    });

    it('プロジェクトIDで絞り込みができる', async () => {
      const filteredResponse = createTestSuiteSearchResponse({
        testSuites: [
          {
            id: 'suite-002',
            name: 'APIテストスイート',
            description: 'API機能のテスト',
            status: 'ACTIVE',
            projectId: 'proj-002',
            project: { id: 'proj-002', name: 'テストプロジェクト2' },
            createdByUser: { id: 'test-user-001', name: 'MCP Tools Test User', avatarUrl: null },
            _count: { testCases: 10, preconditions: 1 },
            createdAt: '2024-01-05T00:00:00.000Z',
            updatedAt: '2024-01-06T00:00:00.000Z',
          },
        ],
        total: 1,
      });
      setApiResponses({ '/test-suites': filteredResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_suite', {
        projectId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createTestSuiteSearchResponse>;
      expect(result.testSuites).toHaveLength(1);
      expect(result.testSuites[0].projectId).toBe('proj-002');
    });

    it('ステータスで絞り込みができる', async () => {
      const draftResponse = createTestSuiteSearchResponse({
        testSuites: [
          {
            id: 'suite-003',
            name: '下書きテストスイート',
            description: null,
            status: 'DRAFT',
            projectId: 'proj-001',
            project: { id: 'proj-001', name: 'テストプロジェクト1' },
            createdByUser: null,
            _count: { testCases: 0, preconditions: 0 },
            createdAt: '2024-02-01T00:00:00.000Z',
            updatedAt: '2024-02-01T00:00:00.000Z',
          },
        ],
        total: 1,
      });
      setApiResponses({ '/test-suites': draftResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_suite', {
        status: 'DRAFT',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createTestSuiteSearchResponse>;
      expect(result.testSuites).toHaveLength(1);
      expect(result.testSuites[0].status).toBe('DRAFT');
    });

    it('検索結果が空の場合、空配列が返る', async () => {
      const emptyResponse = createEmptyResponse('testSuites');
      setApiResponses({ '/test-suites': emptyResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_suite', {
        q: '存在しないスイート',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as { testSuites: unknown[] };
      expect(result.testSuites).toHaveLength(0);
    });
  });

  // ===========================================
  // search_test_case ツールのテスト
  // ===========================================
  describe('search_test_case ツール', () => {
    const testSuiteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    it('テストケース一覧を正常に取得できる', async () => {
      const mockResponse = createTestCaseSearchResponse();
      setApiResponses({ '/test-cases': mockResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_case', {
        testSuiteId,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createTestCaseSearchResponse>;
      expect(result.testCases).toHaveLength(2);
      expect(result.testCases[0].id).toBe('case-001');
      expect(result.testCases[0].title).toBe('正常ログインテスト');
      expect(result.testCases[1].id).toBe('case-002');
    });

    it('キーワードで絞り込みができる', async () => {
      const filteredResponse = createTestCaseSearchResponse({
        testCases: [
          {
            id: 'case-001',
            testSuiteId: 'suite-001',
            title: '正常ログインテスト',
            description: '正しい資格情報でログインできること',
            status: 'ACTIVE',
            priority: 'HIGH',
            orderKey: 'a0',
            createdByUser: { id: 'test-user-001', name: 'MCP Tools Test User', avatarUrl: null },
            _count: { preconditions: 1, steps: 3, expectedResults: 2 },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-02T00:00:00.000Z',
          },
        ],
        total: 1,
      });
      setApiResponses({ '/test-cases': filteredResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_case', {
        testSuiteId,
        q: '正常',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createTestCaseSearchResponse>;
      expect(result.testCases).toHaveLength(1);
      expect(result.testCases[0].title).toContain('正常');
    });

    it('優先度で絞り込みができる', async () => {
      const highPriorityResponse = createTestCaseSearchResponse({
        testCases: [
          {
            id: 'case-001',
            testSuiteId: 'suite-001',
            title: '正常ログインテスト',
            description: '高優先度テスト',
            status: 'ACTIVE',
            priority: 'HIGH',
            orderKey: 'a0',
            createdByUser: null,
            _count: { preconditions: 0, steps: 1, expectedResults: 1 },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
      });
      setApiResponses({ '/test-cases': highPriorityResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_case', {
        testSuiteId,
        priority: ['HIGH'],
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createTestCaseSearchResponse>;
      expect(result.testCases).toHaveLength(1);
      expect(result.testCases[0].priority).toBe('HIGH');
    });

    it('ステータスで絞り込みができる', async () => {
      const draftCaseResponse = createTestCaseSearchResponse({
        testCases: [
          {
            id: 'case-003',
            testSuiteId: 'suite-001',
            title: '下書きテストケース',
            description: null,
            status: 'DRAFT',
            priority: 'LOW',
            orderKey: 'a2',
            createdByUser: null,
            _count: { preconditions: 0, steps: 0, expectedResults: 0 },
            createdAt: '2024-02-01T00:00:00.000Z',
            updatedAt: '2024-02-01T00:00:00.000Z',
          },
        ],
        total: 1,
      });
      setApiResponses({ '/test-cases': draftCaseResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_case', {
        testSuiteId,
        status: ['DRAFT'],
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createTestCaseSearchResponse>;
      expect(result.testCases).toHaveLength(1);
      expect(result.testCases[0].status).toBe('DRAFT');
    });

    it('検索結果が空の場合、空配列が返る', async () => {
      const emptyResponse = createEmptyResponse('testCases');
      setApiResponses({ '/test-cases': emptyResponse });

      const response = await callMcpTool(app, sessionId, 'search_test_case', {
        testSuiteId,
        q: '存在しないテストケース',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as { testCases: unknown[] };
      expect(result.testCases).toHaveLength(0);
    });
  });

  // ===========================================
  // search_execution ツールのテスト
  // ===========================================
  describe('search_execution ツール', () => {
    const testSuiteId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

    it('実行履歴一覧を正常に取得できる', async () => {
      const mockResponse = createExecutionSearchResponse();
      setApiResponses({ '/executions': mockResponse });

      const response = await callMcpTool(app, sessionId, 'search_execution', {
        testSuiteId,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createExecutionSearchResponse>;
      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].id).toBe('exec-001');
      expect(result.executions[0].executedByUser?.name).toBe('MCP Tools Test User');
    });

    it('日付範囲で絞り込みができる', async () => {
      const dateFilteredResponse = createExecutionSearchResponse({
        executions: [
          {
            id: 'exec-002',
            testSuiteId: 'suite-001',
            executedByUser: { id: 'test-user-001', name: 'MCP Tools Test User', avatarUrl: null },
            environment: null,
            createdAt: '2024-01-15T12:00:00.000Z',
            updatedAt: '2024-01-15T13:00:00.000Z',
          },
        ],
        total: 1,
      });
      setApiResponses({ '/executions': dateFilteredResponse });

      const response = await callMcpTool(app, sessionId, 'search_execution', {
        testSuiteId,
        from: '2024-01-10T00:00:00.000Z',
        to: '2024-01-31T23:59:59.999Z',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as ReturnType<typeof createExecutionSearchResponse>;
      expect(result.executions).toHaveLength(1);
      expect(result.executions[0].id).toBe('exec-002');
    });

    it('検索結果が空の場合、空配列が返る', async () => {
      const emptyResponse = createEmptyResponse('executions');
      setApiResponses({ '/executions': emptyResponse });

      const response = await callMcpTool(app, sessionId, 'search_execution', {
        testSuiteId,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as { executions: unknown[] };
      expect(result.executions).toHaveLength(0);
    });
  });

  // ===========================================
  // エラーハンドリングのテスト
  // ===========================================
  describe('エラーハンドリング', () => {
    it('APIエラーがMCPフォーマットのエラーに変換される', async () => {
      setApiError('サーバー内部エラーが発生しました', 500);

      const response = await callMcpTool(app, sessionId, 'search_project', {});

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);

      const errorMessage = getToolErrorMessage(response);
      expect(errorMessage).toContain('エラー');
      expect(errorMessage).toContain('Internal API error');
    });

    it('API 404エラーがMCPフォーマットのエラーに変換される', async () => {
      setApiError('リソースが見つかりません', 404);

      const response = await callMcpTool(app, sessionId, 'search_test_suite', {});

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);

      const errorMessage = getToolErrorMessage(response);
      expect(errorMessage).toContain('エラー');
    });

    it('認証されていない状態でツール呼び出しが拒否される', async () => {
      // 認証なしで新しいセッションを開始しようとする
      clearTestAuth();

      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send(createMcpInitializeRequest());

      // 認証エラーで401が返る
      expect(response.status).toBe(401);
    });

    it('無効なトークンでツール呼び出しが拒否される', async () => {
      setAuthError(new Error('トークンが無効です'));

      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=invalid-token')
        .set('Content-Type', 'application/json')
        .send(createMcpInitializeRequest());

      expect(response.status).toBe(401);
    });
  });
});
