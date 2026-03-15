import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';
import {
  parseToolResultJson as parseToolResult,
  isToolError,
  getToolContentText,
  initializeMcpSession,
  callMcpTool,
} from './mcp-tools-helpers.js';
import { createApp } from '../../app.js';

// --- テスト用モックデータ ---

const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_USER_EMAIL = 'crud-test@example.com';
const TEST_PROJECT_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_CASE_ID = '44444444-4444-4444-4444-444444444444';
const TEST_EXECUTION_ID = '55555555-5555-5555-5555-555555555555';
const TEST_STEP_ID_1 = 'aabbccdd-0001-0001-0001-000000000001';
const TEST_STEP_ID_2 = 'aabbccdd-0002-0002-0002-000000000002';
const TEST_STEP_ID_3 = 'aabbccdd-0003-0003-0003-000000000003';

// グローバルな認証状態（モック用）
let mockAuthUser: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  deletedAt: Date | null;
} | null = null;

// モック用のverifyAccessToken結果
let mockVerifyAccessTokenResult: { sub: string; email: string } | null = null;

// --- apiClient モック ---
// ツール内部でapiClient.get/post/patch/deleteを呼び出すため、これをモックする
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();
const mockApiPatch = vi.fn();
const mockApiDelete = vi.fn();

vi.mock('../../clients/api-client.js', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiGet(...args),
    post: (...args: unknown[]) => mockApiPost(...args),
    patch: (...args: unknown[]) => mockApiPatch(...args),
    delete: (...args: unknown[]) => mockApiDelete(...args),
  },
  checkLockStatus: vi.fn().mockResolvedValue(undefined),
  InternalApiClient: vi.fn(),
  LockConflictError: class LockConflictError extends Error {
    public readonly lockedBy: unknown;
    public readonly expiresAt: string;
    constructor(lockedBy: unknown, expiresAt: string) {
      super('ロック中');
      this.name = 'LockConflictError';
      this.lockedBy = lockedBy;
      this.expiresAt = expiresAt;
    }
  },
}));

// --- 認証モック ---
vi.mock('@agentest/auth', () => ({
  verifyAccessToken: vi.fn().mockImplementation(() => {
    return mockVerifyAccessTokenResult;
  }),
}));

// --- Prisma userモック ---
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
          return null;
        }),
      },
      agentSession: {
        ...original.prisma.agentSession,
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'session-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
    },
  };
});

/**
 * テスト用の認証情報をセットアップ
 */
function setTestAuth() {
  mockAuthUser = {
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    name: 'CRUD Test User',
    avatarUrl: null,
    deletedAt: null,
  };
  mockVerifyAccessTokenResult = { sub: TEST_USER_ID, email: TEST_USER_EMAIL };
}

describe('MCP CRUDツール統合テスト', () => {
  let app: Express;
  let sessionId: string;

  beforeAll(async () => {
    app = createApp();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    setTestAuth();

    // ロック確認をデフォルトで通過させる
    const { checkLockStatus } = await import('../../clients/api-client.js');
    vi.mocked(checkLockStatus).mockResolvedValue(undefined);

    // 新しいセッションを初期化
    sessionId = await initializeMcpSession(app);
  });

  // ========================================
  // get_project テスト
  // ========================================
  describe('get_project', () => {
    it('プロジェクトを正常に取得できる', async () => {
      const mockProject = {
        project: {
          id: TEST_PROJECT_ID,
          name: 'テストプロジェクト',
          description: 'テスト用プロジェクト',
          organizationId: null,
          organization: null,
          role: 'OWNER',
          environments: [
            {
              id: 'env-1',
              projectId: TEST_PROJECT_ID,
              name: 'Development',
              baseUrl: 'http://localhost:3000',
              description: null,
              isDefault: true,
              sortOrder: 0,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          _count: { testSuites: 3 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockApiGet.mockResolvedValueOnce(mockProject);

      const response = await callMcpTool(app, sessionId, 'get_project', {
        projectId: TEST_PROJECT_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockProject;
      expect(result.project.id).toBe(TEST_PROJECT_ID);
      expect(result.project.name).toBe('テストプロジェクト');
      expect(result.project.environments).toHaveLength(1);
      expect(result.project._count.testSuites).toBe(3);
    });

    it('API 404エラー時にMCPエラーに変換される', async () => {
      mockApiGet.mockRejectedValueOnce(
        new Error('Internal API error: 404 - プロジェクトが見つかりません')
      );

      const response = await callMcpTool(app, sessionId, 'get_project', {
        projectId: TEST_PROJECT_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);

      const text = getToolContentText(response);
      expect(text).toContain('エラー');
      expect(text).toContain('404');
    });
  });

  // ========================================
  // get_test_suite テスト
  // ========================================
  describe('get_test_suite', () => {
    it('テストスイートを正常に取得できる', async () => {
      const mockSuite = {
        testSuite: {
          id: TEST_SUITE_ID,
          name: 'ログインテストスイート',
          description: 'ログイン機能のテスト',
          status: 'ACTIVE',
          projectId: TEST_PROJECT_ID,
          project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
          createdByUser: { id: TEST_USER_ID, name: 'CRUD Test User', avatarUrl: null },
          preconditions: [],
          testCases: [],
          _count: { testCases: 0, preconditions: 0 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockApiGet.mockResolvedValueOnce(mockSuite);

      const response = await callMcpTool(app, sessionId, 'get_test_suite', {
        testSuiteId: TEST_SUITE_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockSuite;
      expect(result.testSuite.id).toBe(TEST_SUITE_ID);
      expect(result.testSuite.name).toBe('ログインテストスイート');
      expect(result.testSuite.status).toBe('ACTIVE');
    });

    it('関連データ（テストケース一覧）を含めて取得できる', async () => {
      const mockSuite = {
        testSuite: {
          id: TEST_SUITE_ID,
          name: '認証テストスイート',
          description: null,
          status: 'DRAFT',
          projectId: TEST_PROJECT_ID,
          project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
          createdByUser: null,
          preconditions: [
            {
              id: 'pre-1',
              testSuiteId: TEST_SUITE_ID,
              content: 'テスト環境が起動していること',
              orderKey: 'a',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          testCases: [
            {
              id: TEST_CASE_ID,
              testSuiteId: TEST_SUITE_ID,
              title: 'ログイン成功テスト',
              description: null,
              priority: 'HIGH',
              status: 'ACTIVE',
              orderKey: 'a',
              _count: { preconditions: 1, steps: 3, expectedResults: 2 },
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          _count: { testCases: 1, preconditions: 1 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockApiGet.mockResolvedValueOnce(mockSuite);

      const response = await callMcpTool(app, sessionId, 'get_test_suite', {
        testSuiteId: TEST_SUITE_ID,
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response) as typeof mockSuite;
      expect(result.testSuite.preconditions).toHaveLength(1);
      expect(result.testSuite.testCases).toHaveLength(1);
      expect(result.testSuite.testCases[0].title).toBe('ログイン成功テスト');
      expect(result.testSuite._count.testCases).toBe(1);
    });
  });

  // ========================================
  // get_test_case テスト
  // ========================================
  describe('get_test_case', () => {
    it('テストケースを正常に取得できる', async () => {
      const mockCase = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          testSuite: { id: TEST_SUITE_ID, name: 'テストスイート', projectId: TEST_PROJECT_ID },
          title: 'ユーザー登録テスト',
          description: 'ユーザー登録フローのテスト',
          priority: 'HIGH',
          status: 'ACTIVE',
          orderKey: 'a',
          createdByUser: { id: TEST_USER_ID, name: 'CRUD Test User', avatarUrl: null },
          preconditions: [
            {
              id: 'pre-1',
              testCaseId: TEST_CASE_ID,
              content: 'メールアドレスが未登録であること',
              orderKey: 'a',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          steps: [
            {
              id: 'step-1',
              testCaseId: TEST_CASE_ID,
              content: '登録ページにアクセスする',
              orderKey: 'a',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
            {
              id: 'step-2',
              testCaseId: TEST_CASE_ID,
              content: '必要情報を入力して送信する',
              orderKey: 'b',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          expectedResults: [
            {
              id: 'er-1',
              testCaseId: TEST_CASE_ID,
              content: '登録完了ページが表示される',
              orderKey: 'a',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockApiGet.mockResolvedValueOnce(mockCase);

      const response = await callMcpTool(app, sessionId, 'get_test_case', {
        testCaseId: TEST_CASE_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockCase;
      expect(result.testCase.id).toBe(TEST_CASE_ID);
      expect(result.testCase.title).toBe('ユーザー登録テスト');
      expect(result.testCase.preconditions).toHaveLength(1);
      expect(result.testCase.steps).toHaveLength(2);
      expect(result.testCase.expectedResults).toHaveLength(1);
    });

    it('APIエラー時にMCPエラーとして返される', async () => {
      mockApiGet.mockRejectedValueOnce(new Error('Internal API error: 500 - サーバー内部エラー'));

      const response = await callMcpTool(app, sessionId, 'get_test_case', {
        testCaseId: TEST_CASE_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);

      const text = getToolContentText(response);
      expect(text).toContain('エラー');
      expect(text).toContain('500');
    });
  });

  // ========================================
  // get_execution テスト
  // ========================================
  describe('get_execution', () => {
    it('実行結果を正常に取得できる', async () => {
      const mockExecution = {
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          testSuite: { id: TEST_SUITE_ID, name: 'テストスイート', projectId: TEST_PROJECT_ID },
          executedByUser: { id: TEST_USER_ID, name: 'CRUD Test User', avatarUrl: null },
          environment: { id: 'env-1', name: 'Development' },
          executionTestSuite: null,
          preconditionResults: [],
          stepResults: [],
          expectedResults: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockApiGet.mockResolvedValueOnce(mockExecution);

      const response = await callMcpTool(app, sessionId, 'get_execution', {
        executionId: TEST_EXECUTION_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockExecution;
      expect(result.execution.id).toBe(TEST_EXECUTION_ID);
      expect(result.execution.testSuiteId).toBe(TEST_SUITE_ID);
      expect(result.execution.executedByUser?.name).toBe('CRUD Test User');
    });
  });

  // ========================================
  // create_test_suite テスト
  // ========================================
  describe('create_test_suite', () => {
    it('テストスイートを正常に作成できる', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: TEST_PROJECT_ID,
          name: '新しいテストスイート',
          description: 'テストスイートの説明',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockApiPost.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'create_test_suite', {
        projectId: TEST_PROJECT_ID,
        name: '新しいテストスイート',
        description: 'テストスイートの説明',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.testSuite.name).toBe('新しいテストスイート');
      expect(result.testSuite.status).toBe('DRAFT');
      expect(result.testSuite.projectId).toBe(TEST_PROJECT_ID);

      // apiClientに正しい引数が渡されたことを確認
      expect(mockApiPost).toHaveBeenCalledWith(
        '/internal/api/test-suites',
        expect.objectContaining({
          projectId: TEST_PROJECT_ID,
          name: '新しいテストスイート',
          description: 'テストスイートの説明',
        }),
        { userId: TEST_USER_ID }
      );
    });

    it('名前なしでバリデーションエラーが返る', async () => {
      const response = await callMcpTool(app, sessionId, 'create_test_suite', {
        projectId: TEST_PROJECT_ID,
        // name を指定しない
      });

      expect(response.status).toBe(200);
      // Zodバリデーションエラーはツール呼び出し前にMCP SDKレベルで処理される
      // MCP SDKがZodバリデーションエラーをerrorレスポンスとして返す
      expect(isToolError(response)).toBe(true);
    });

    it('API 403エラー時にMCPエラーに変換される', async () => {
      mockApiPost.mockRejectedValueOnce(
        new Error('Internal API error: 403 - このプロジェクトへのアクセス権がありません')
      );

      const response = await callMcpTool(app, sessionId, 'create_test_suite', {
        projectId: TEST_PROJECT_ID,
        name: '権限なしテスト',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);

      const text = getToolContentText(response);
      expect(text).toContain('エラー');
      expect(text).toContain('403');
    });
  });

  // ========================================
  // create_test_case テスト
  // ========================================
  describe('create_test_case', () => {
    it('テストケースを正常に作成できる', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: '新しいテストケース',
          description: 'テストケースの説明',
          priority: 'MEDIUM',
          status: 'DRAFT',
          orderKey: 'a',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          preconditions: [],
          steps: [{ id: 'step-1', content: 'ページにアクセスする', orderKey: 'a' }],
          expectedResults: [{ id: 'er-1', content: 'ページが表示される', orderKey: 'a' }],
        },
      };

      mockApiPost.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'create_test_case', {
        testSuiteId: TEST_SUITE_ID,
        title: '新しいテストケース',
        description: 'テストケースの説明',
        steps: [{ content: 'ページにアクセスする' }],
        expectedResults: [{ content: 'ページが表示される' }],
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.testCase.title).toBe('新しいテストケース');
      expect(result.testCase.steps).toHaveLength(1);
      expect(result.testCase.expectedResults).toHaveLength(1);
    });

    it('優先度を指定してテストケースを作成できる', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'クリティカルテスト',
          description: null,
          priority: 'CRITICAL',
          status: 'ACTIVE',
          orderKey: 'a',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      mockApiPost.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'create_test_case', {
        testSuiteId: TEST_SUITE_ID,
        title: 'クリティカルテスト',
        priority: 'CRITICAL',
        status: 'ACTIVE',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.testCase.priority).toBe('CRITICAL');
      expect(result.testCase.status).toBe('ACTIVE');

      // apiClientに優先度が渡されたことを確認
      expect(mockApiPost).toHaveBeenCalledWith(
        '/internal/api/test-cases',
        expect.objectContaining({
          priority: 'CRITICAL',
          status: 'ACTIVE',
        }),
        { userId: TEST_USER_ID }
      );
    });
  });

  // ========================================
  // update_test_suite テスト
  // ========================================
  describe('update_test_suite', () => {
    it('テストスイートを正常に更新できる', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: TEST_PROJECT_ID,
          name: '更新後のテストスイート',
          description: '更新後の説明',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      };

      mockApiPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_test_suite', {
        testSuiteId: TEST_SUITE_ID,
        name: '更新後のテストスイート',
        description: '更新後の説明',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.testSuite.name).toBe('更新後のテストスイート');
      expect(result.testSuite.description).toBe('更新後の説明');

      // apiClient.patchが正しいパスで呼ばれたことを確認
      expect(mockApiPatch).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}`,
        expect.objectContaining({
          name: '更新後のテストスイート',
          description: '更新後の説明',
        }),
        { userId: TEST_USER_ID }
      );
    });

    it('ステータスを変更できる', async () => {
      const mockResponse = {
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: TEST_PROJECT_ID,
          name: 'テストスイート',
          description: null,
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      };

      mockApiPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_test_suite', {
        testSuiteId: TEST_SUITE_ID,
        status: 'ACTIVE',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.testSuite.status).toBe('ACTIVE');
    });
  });

  // ========================================
  // update_test_case テスト
  // ========================================
  describe('update_test_case', () => {
    it('テストケースを正常に更新できる', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: '更新後のテストケース',
          description: '更新後の説明',
          priority: 'HIGH',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          steps: [{ id: TEST_STEP_ID_1, content: '更新した手順', orderKey: 'a' }],
        },
      };

      mockApiPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_test_case', {
        testCaseId: TEST_CASE_ID,
        title: '更新後のテストケース',
        description: '更新後の説明',
        steps: [{ id: TEST_STEP_ID_1, content: '更新した手順' }],
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.testCase.title).toBe('更新後のテストケース');
      expect(result.testCase.steps).toHaveLength(1);
      expect(result.testCase.steps![0].content).toBe('更新した手順');
    });

    it('優先度を変更できる', async () => {
      const mockResponse = {
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId: TEST_SUITE_ID,
          title: 'テストケース',
          description: null,
          priority: 'LOW',
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      };

      mockApiPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_test_case', {
        testCaseId: TEST_CASE_ID,
        priority: 'LOW',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.testCase.priority).toBe('LOW');

      // apiClient.patchに優先度が渡されたことを確認
      expect(mockApiPatch).toHaveBeenCalledWith(
        `/internal/api/test-cases/${TEST_CASE_ID}`,
        expect.objectContaining({
          priority: 'LOW',
        }),
        { userId: TEST_USER_ID }
      );
    });
  });

  // ========================================
  // delete_test_suite テスト
  // ========================================
  describe('delete_test_suite', () => {
    it('テストスイートを正常に削除できる', async () => {
      const mockResponse = {
        success: true,
        deletedId: TEST_SUITE_ID,
      };

      mockApiDelete.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'delete_test_suite', {
        testSuiteId: TEST_SUITE_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(TEST_SUITE_ID);

      // apiClient.deleteが正しいパスで呼ばれたことを確認
      expect(mockApiDelete).toHaveBeenCalledWith(`/internal/api/test-suites/${TEST_SUITE_ID}`, {
        userId: TEST_USER_ID,
      });
    });
  });

  // ========================================
  // delete_test_case テスト
  // ========================================
  describe('delete_test_case', () => {
    it('テストケースを正常に削除できる', async () => {
      const mockResponse = {
        success: true,
        deletedId: TEST_CASE_ID,
      };

      mockApiDelete.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'delete_test_case', {
        testCaseId: TEST_CASE_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(false);

      const result = parseToolResult(response) as typeof mockResponse;
      expect(result.success).toBe(true);
      expect(result.deletedId).toBe(TEST_CASE_ID);

      // apiClient.deleteが正しいパスで呼ばれたことを確認
      expect(mockApiDelete).toHaveBeenCalledWith(`/internal/api/test-cases/${TEST_CASE_ID}`, {
        userId: TEST_USER_ID,
      });
    });

    it('API削除エラー時にMCPエラーとして返される', async () => {
      mockApiDelete.mockRejectedValueOnce(
        new Error('Internal API error: 404 - テストケースが見つかりません')
      );

      const response = await callMcpTool(app, sessionId, 'delete_test_case', {
        testCaseId: TEST_CASE_ID,
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);

      const text = getToolContentText(response);
      expect(text).toContain('エラー');
      expect(text).toContain('404');
    });
  });

  // ========================================
  // Zodバリデーションテスト
  // ========================================
  describe('Zodバリデーション', () => {
    it('無効なUUIDでエラーが返る（get_project）', async () => {
      const response = await callMcpTool(app, sessionId, 'get_project', {
        projectId: 'not-a-valid-uuid',
      });

      expect(response.status).toBe(200);
      // 無効なUUIDの場合、MCP SDKがZodバリデーションエラーを返す
      expect(isToolError(response)).toBe(true);
    });

    it('無効なUUIDでエラーが返る（get_test_suite）', async () => {
      const response = await callMcpTool(app, sessionId, 'get_test_suite', {
        testSuiteId: 'invalid-uuid',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });

    it('無効なUUIDでエラーが返る（get_test_case）', async () => {
      const response = await callMcpTool(app, sessionId, 'get_test_case', {
        testCaseId: 'bad-uuid-format',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });

    it('無効なUUIDでエラーが返る（get_execution）', async () => {
      const response = await callMcpTool(app, sessionId, 'get_execution', {
        executionId: '12345',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });

    it('必須パラメータ不足でエラーが返る（create_test_suite: projectIdなし）', async () => {
      const response = await callMcpTool(app, sessionId, 'create_test_suite', {
        name: 'テスト',
        // projectId を指定しない
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });

    it('必須パラメータ不足でエラーが返る（create_test_case: testSuiteIdなし）', async () => {
      const response = await callMcpTool(app, sessionId, 'create_test_case', {
        title: 'テストケース',
        // testSuiteId を指定しない
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });

    it('必須パラメータ不足でエラーが返る（create_test_case: titleなし）', async () => {
      const response = await callMcpTool(app, sessionId, 'create_test_case', {
        testSuiteId: TEST_SUITE_ID,
        // title を指定しない
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });

    it('必須パラメータ不足でエラーが返る（delete_test_suite: testSuiteIdなし）', async () => {
      const response = await callMcpTool(app, sessionId, 'delete_test_suite', {
        // testSuiteId を指定しない
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });

    it('無効な優先度でエラーが返る（create_test_case）', async () => {
      const response = await callMcpTool(app, sessionId, 'create_test_case', {
        testSuiteId: TEST_SUITE_ID,
        title: 'テスト',
        priority: 'INVALID_PRIORITY',
      });

      expect(response.status).toBe(200);
      expect(isToolError(response)).toBe(true);
    });
  });

  // ========================================
  // CRUD一連操作テスト
  // ========================================
  describe('CRUD一連操作', () => {
    it('テストスイートの作成→取得→更新→削除を一連で実行できる', async () => {
      const suiteId = '66666666-6666-6666-6666-666666666666';

      // 1. 作成
      mockApiPost.mockResolvedValueOnce({
        testSuite: {
          id: suiteId,
          projectId: TEST_PROJECT_ID,
          name: '一連操作テストスイート',
          description: null,
          status: 'DRAFT',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      });

      const createResponse = await callMcpTool(
        app,
        sessionId,
        'create_test_suite',
        {
          projectId: TEST_PROJECT_ID,
          name: '一連操作テストスイート',
        },
        10
      );

      expect(isToolError(createResponse)).toBe(false);
      const created = parseToolResult(createResponse) as {
        testSuite: { id: string; name: string };
      };
      expect(created.testSuite.id).toBe(suiteId);

      // 2. 取得
      mockApiGet.mockResolvedValueOnce({
        testSuite: {
          id: suiteId,
          name: '一連操作テストスイート',
          description: null,
          status: 'DRAFT',
          projectId: TEST_PROJECT_ID,
          project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
          createdByUser: null,
          preconditions: [],
          testCases: [],
          _count: { testCases: 0, preconditions: 0 },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      });

      const getResponse = await callMcpTool(
        app,
        sessionId,
        'get_test_suite',
        {
          testSuiteId: suiteId,
        },
        11
      );

      expect(isToolError(getResponse)).toBe(false);
      const fetched = parseToolResult(getResponse) as {
        testSuite: { name: string; status: string };
      };
      expect(fetched.testSuite.name).toBe('一連操作テストスイート');
      expect(fetched.testSuite.status).toBe('DRAFT');

      // 3. 更新
      mockApiPatch.mockResolvedValueOnce({
        testSuite: {
          id: suiteId,
          projectId: TEST_PROJECT_ID,
          name: '更新済みテストスイート',
          description: '説明を追加',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      });

      const updateResponse = await callMcpTool(
        app,
        sessionId,
        'update_test_suite',
        {
          testSuiteId: suiteId,
          name: '更新済みテストスイート',
          description: '説明を追加',
          status: 'ACTIVE',
        },
        12
      );

      expect(isToolError(updateResponse)).toBe(false);
      const updated = parseToolResult(updateResponse) as {
        testSuite: { name: string; status: string; description: string };
      };
      expect(updated.testSuite.name).toBe('更新済みテストスイート');
      expect(updated.testSuite.status).toBe('ACTIVE');
      expect(updated.testSuite.description).toBe('説明を追加');

      // 4. 削除
      mockApiDelete.mockResolvedValueOnce({
        success: true,
        deletedId: suiteId,
      });

      const deleteResponse = await callMcpTool(
        app,
        sessionId,
        'delete_test_suite',
        {
          testSuiteId: suiteId,
        },
        13
      );

      expect(isToolError(deleteResponse)).toBe(false);
      const deleted = parseToolResult(deleteResponse) as { success: boolean; deletedId: string };
      expect(deleted.success).toBe(true);
      expect(deleted.deletedId).toBe(suiteId);
    });

    it('テストケースの作成→取得→更新→削除を一連で実行できる', async () => {
      const caseId = '77777777-7777-7777-7777-777777777777';

      // 1. 作成
      mockApiPost.mockResolvedValueOnce({
        testCase: {
          id: caseId,
          testSuiteId: TEST_SUITE_ID,
          title: '一連操作テストケース',
          description: null,
          priority: 'MEDIUM',
          status: 'DRAFT',
          orderKey: 'a',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          steps: [{ id: TEST_STEP_ID_2, content: '初期手順', orderKey: 'a' }],
        },
      });

      const createResponse = await callMcpTool(
        app,
        sessionId,
        'create_test_case',
        {
          testSuiteId: TEST_SUITE_ID,
          title: '一連操作テストケース',
          steps: [{ content: '初期手順' }],
        },
        20
      );

      expect(isToolError(createResponse)).toBe(false);
      const created = parseToolResult(createResponse) as {
        testCase: { id: string; title: string };
      };
      expect(created.testCase.id).toBe(caseId);

      // 2. 取得
      mockApiGet.mockResolvedValueOnce({
        testCase: {
          id: caseId,
          testSuiteId: TEST_SUITE_ID,
          testSuite: { id: TEST_SUITE_ID, name: 'テストスイート', projectId: TEST_PROJECT_ID },
          title: '一連操作テストケース',
          description: null,
          priority: 'MEDIUM',
          status: 'DRAFT',
          orderKey: 'a',
          createdByUser: null,
          preconditions: [],
          steps: [
            {
              id: TEST_STEP_ID_2,
              testCaseId: caseId,
              content: '初期手順',
              orderKey: 'a',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          expectedResults: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      });

      const getResponse = await callMcpTool(
        app,
        sessionId,
        'get_test_case',
        {
          testCaseId: caseId,
        },
        21
      );

      expect(isToolError(getResponse)).toBe(false);
      const fetched = parseToolResult(getResponse) as {
        testCase: { title: string; steps: { content: string }[] };
      };
      expect(fetched.testCase.title).toBe('一連操作テストケース');
      expect(fetched.testCase.steps).toHaveLength(1);

      // 3. 更新（タイトル変更、ステップ追加）
      mockApiPatch.mockResolvedValueOnce({
        testCase: {
          id: caseId,
          testSuiteId: TEST_SUITE_ID,
          title: '更新済みテストケース',
          description: 'ケース説明追加',
          priority: 'HIGH',
          status: 'ACTIVE',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
          steps: [
            { id: TEST_STEP_ID_2, content: '更新した手順1', orderKey: 'a' },
            { id: TEST_STEP_ID_3, content: '追加した手順2', orderKey: 'b' },
          ],
        },
      });

      const updateResponse = await callMcpTool(
        app,
        sessionId,
        'update_test_case',
        {
          testCaseId: caseId,
          title: '更新済みテストケース',
          description: 'ケース説明追加',
          priority: 'HIGH',
          status: 'ACTIVE',
          steps: [{ id: TEST_STEP_ID_2, content: '更新した手順1' }, { content: '追加した手順2' }],
        },
        22
      );

      expect(isToolError(updateResponse)).toBe(false);
      const updated = parseToolResult(updateResponse) as {
        testCase: { title: string; priority: string; steps: { content: string }[] };
      };
      expect(updated.testCase.title).toBe('更新済みテストケース');
      expect(updated.testCase.priority).toBe('HIGH');
      expect(updated.testCase.steps).toHaveLength(2);

      // 4. 削除
      mockApiDelete.mockResolvedValueOnce({
        success: true,
        deletedId: caseId,
      });

      const deleteResponse = await callMcpTool(
        app,
        sessionId,
        'delete_test_case',
        {
          testCaseId: caseId,
        },
        23
      );

      expect(isToolError(deleteResponse)).toBe(false);
      const deleted = parseToolResult(deleteResponse) as { success: boolean; deletedId: string };
      expect(deleted.success).toBe(true);
      expect(deleted.deletedId).toBe(caseId);
    });
  });
});
