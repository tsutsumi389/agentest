import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import { createTestUser, createTestProject, cleanupTestData } from './test-helpers.js';
import {
  parseToolResultRaw as parseToolResult,
  initializeMcpSession,
  callMcpTool,
} from './mcp-tools-helpers.js';
import { createApp } from '../../app.js';

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
let mockVerifyAccessTokenError: Error | null = null;

// 認証モック
vi.mock('@agentest/auth', () => ({
  verifyAccessToken: vi.fn().mockImplementation(() => {
    if (mockVerifyAccessTokenError) {
      throw mockVerifyAccessTokenError;
    }
    return mockVerifyAccessTokenResult;
  }),
}));

// Prisma userモック
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

// fs/promisesモック（upload_execution_evidenceで使用）
const mockFsReadFile = vi.fn().mockResolvedValue(Buffer.from('test-image-data'));
const mockFsStat = vi.fn().mockResolvedValue({ size: 100 });
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: (...args: unknown[]) => mockFsReadFile(...args),
    stat: (...args: unknown[]) => mockFsStat(...args),
  },
}));

// apiClientモック
const mockApiClientGet = vi.fn();
const mockApiClientPost = vi.fn();
const mockApiClientPatch = vi.fn();
const mockApiClientPostMultipart = vi.fn();

vi.mock('../../clients/api-client.js', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiClientGet(...args),
    post: (...args: unknown[]) => mockApiClientPost(...args),
    patch: (...args: unknown[]) => mockApiClientPatch(...args),
    postMultipart: (...args: unknown[]) => mockApiClientPostMultipart(...args),
    delete: vi.fn(),
  },
  checkLockStatus: vi.fn().mockResolvedValue(undefined),
  LockConflictError: class LockConflictError extends Error {
    public readonly lockedBy: unknown;
    public readonly expiresAt: string;
    constructor(lockedBy: unknown, expiresAt: string) {
      super('Lock conflict');
      this.name = 'LockConflictError';
      this.lockedBy = lockedBy;
      this.expiresAt = expiresAt;
    }
  },
}));

function setTestAuth(user: typeof mockAuthUser, tokenPayload?: { sub: string; email: string }) {
  mockAuthUser = user;
  mockVerifyAccessTokenResult = tokenPayload ?? (user ? { sub: user.id, email: user.email } : null);
  mockVerifyAccessTokenError = null;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockVerifyAccessTokenResult = null;
  mockVerifyAccessTokenError = null;
}

// テスト用UUID定数
const TEST_EXECUTION_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_ENVIRONMENT_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PRECONDITION_RESULT_ID = '44444444-4444-4444-4444-444444444444';
const TEST_STEP_RESULT_ID = '55555555-5555-5555-5555-555555555555';
const TEST_EXPECTED_RESULT_ID = '66666666-6666-6666-6666-666666666666';
const TEST_EVIDENCE_ID = '77777777-7777-7777-7777-777777777777';

describe('MCP実行ツール統合テスト', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProject: Awaited<ReturnType<typeof createTestProject>>;
  let sessionId: string;

  beforeAll(async () => {
    app = createApp();
  });

  afterAll(async () => {
    await cleanupTestData();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
    clearTestAuth();

    // テストユーザーとプロジェクトを作成
    testUser = await createTestUser({
      email: 'execution-test@example.com',
      name: 'Execution Test User',
    });
    testProject = await createTestProject(testUser.id, {
      name: 'Execution Test Project',
    });

    // 認証を設定
    setTestAuth({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      avatarUrl: null,
      deletedAt: null,
    });

    // MCPセッションを初期化
    sessionId = await initializeMcpSession(app, { projectId: testProject.id });
  });

  describe('create_execution', () => {
    it('テストスイートIDを指定して正常に実行を作成できる', async () => {
      const mockResponse = {
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          environmentId: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      };
      mockApiClientPost.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId: TEST_SUITE_ID,
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.execution.id).toBe(TEST_EXECUTION_ID);
      expect(parsed.execution.testSuiteId).toBe(TEST_SUITE_ID);
      expect(parsed.execution.environmentId).toBeNull();

      // apiClientが正しいパスとパラメータで呼ばれたことを確認
      expect(mockApiClientPost).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/executions`,
        { environmentId: undefined },
        { userId: testUser.id }
      );
    });

    it('environmentIdを指定して実行を作成できる', async () => {
      const mockResponse = {
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          environmentId: TEST_ENVIRONMENT_ID,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      };
      mockApiClientPost.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId: TEST_SUITE_ID,
        environmentId: TEST_ENVIRONMENT_ID,
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.execution.environmentId).toBe(TEST_ENVIRONMENT_ID);

      expect(mockApiClientPost).toHaveBeenCalledWith(
        `/internal/api/test-suites/${TEST_SUITE_ID}/executions`,
        { environmentId: TEST_ENVIRONMENT_ID },
        { userId: testUser.id }
      );
    });
  });

  describe('update_execution_precondition_result', () => {
    it('METステータスで前提条件結果を更新できる', async () => {
      const mockResponse = {
        preconditionResult: {
          id: TEST_PRECONDITION_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'MET',
          note: null,
          checkedAt: '2025-01-01T00:00:00.000Z',
          checkedByUser: { id: testUser.id, name: testUser.name, avatarUrl: null },
          checkedByAgentName: null,
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_precondition_result', {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.preconditionResult.status).toBe('MET');

      expect(mockApiClientPatch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/precondition-results/${TEST_PRECONDITION_RESULT_ID}`,
        { status: 'MET', note: undefined, agentName: undefined },
        { userId: testUser.id }
      );
    });

    it('NOT_METステータスで前提条件結果を更新できる', async () => {
      const mockResponse = {
        preconditionResult: {
          id: TEST_PRECONDITION_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'NOT_MET',
          note: null,
          checkedAt: '2025-01-01T00:00:00.000Z',
          checkedByUser: null,
          checkedByAgentName: null,
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_precondition_result', {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'NOT_MET',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.preconditionResult.status).toBe('NOT_MET');
    });

    it('noteとagentNameを含めて前提条件結果を更新できる', async () => {
      const mockResponse = {
        preconditionResult: {
          id: TEST_PRECONDITION_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'MET',
          note: 'データベースが初期化済みであることを確認',
          checkedAt: '2025-01-01T00:00:00.000Z',
          checkedByUser: null,
          checkedByAgentName: 'Claude Code Opus4.5',
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_precondition_result', {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET',
        note: 'データベースが初期化済みであることを確認',
        agentName: 'Claude Code Opus4.5',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.preconditionResult.note).toBe('データベースが初期化済みであることを確認');
      expect(parsed.preconditionResult.checkedByAgentName).toBe('Claude Code Opus4.5');

      expect(mockApiClientPatch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/precondition-results/${TEST_PRECONDITION_RESULT_ID}`,
        {
          status: 'MET',
          note: 'データベースが初期化済みであることを確認',
          agentName: 'Claude Code Opus4.5',
        },
        { userId: testUser.id }
      );
    });
  });

  describe('update_execution_step_result', () => {
    it('DONEステータスでステップ結果を更新できる', async () => {
      const mockResponse = {
        stepResult: {
          id: TEST_STEP_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'DONE',
          note: null,
          executedAt: '2025-01-01T00:00:00.000Z',
          executedByUser: { id: testUser.id, name: testUser.name, avatarUrl: null },
          executedByAgentName: null,
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_step_result', {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stepResult.status).toBe('DONE');

      expect(mockApiClientPatch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/step-results/${TEST_STEP_RESULT_ID}`,
        { status: 'DONE', note: undefined, agentName: undefined },
        { userId: testUser.id }
      );
    });

    it('SKIPPEDステータスでステップ結果を更新できる', async () => {
      const mockResponse = {
        stepResult: {
          id: TEST_STEP_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'SKIPPED',
          note: null,
          executedAt: null,
          executedByUser: null,
          executedByAgentName: null,
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_step_result', {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'SKIPPED',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stepResult.status).toBe('SKIPPED');
    });

    it('noteを含めてステップ結果を更新できる', async () => {
      const mockResponse = {
        stepResult: {
          id: TEST_STEP_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'DONE',
          note: 'ボタンクリック後に画面遷移を確認',
          executedAt: '2025-01-01T00:00:00.000Z',
          executedByUser: null,
          executedByAgentName: 'Claude Code Opus4.5',
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_step_result', {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE',
        note: 'ボタンクリック後に画面遷移を確認',
        agentName: 'Claude Code Opus4.5',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.stepResult.note).toBe('ボタンクリック後に画面遷移を確認');
      expect(parsed.stepResult.executedByAgentName).toBe('Claude Code Opus4.5');
    });
  });

  describe('update_execution_expected_result', () => {
    it('PASSステータスで期待結果を更新できる', async () => {
      const mockResponse = {
        expectedResult: {
          id: TEST_EXPECTED_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'PASS',
          note: null,
          judgedAt: '2025-01-01T00:00:00.000Z',
          judgedByUser: { id: testUser.id, name: testUser.name, avatarUrl: null },
          judgedByAgentName: null,
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_expected_result', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'PASS',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.expectedResult.status).toBe('PASS');

      expect(mockApiClientPatch).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}`,
        { status: 'PASS', note: undefined, agentName: undefined },
        { userId: testUser.id }
      );
    });

    it('FAILステータスで期待結果を更新できる', async () => {
      const mockResponse = {
        expectedResult: {
          id: TEST_EXPECTED_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'FAIL',
          note: null,
          judgedAt: '2025-01-01T00:00:00.000Z',
          judgedByUser: null,
          judgedByAgentName: null,
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_expected_result', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'FAIL',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.expectedResult.status).toBe('FAIL');
    });

    it('noteを含めて期待結果を更新できる', async () => {
      const mockResponse = {
        expectedResult: {
          id: TEST_EXPECTED_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'FAIL',
          note: '期待値: 200 OK, 実際値: 500 Internal Server Error',
          judgedAt: '2025-01-01T00:00:00.000Z',
          judgedByUser: null,
          judgedByAgentName: 'Claude Code Opus4.5',
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_expected_result', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'FAIL',
        note: '期待値: 200 OK, 実際値: 500 Internal Server Error',
        agentName: 'Claude Code Opus4.5',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.expectedResult.note).toBe('期待値: 200 OK, 実際値: 500 Internal Server Error');
      expect(parsed.expectedResult.judgedByAgentName).toBe('Claude Code Opus4.5');
    });

    it('SKIPPEDステータスで期待結果を更新できる', async () => {
      const mockResponse = {
        expectedResult: {
          id: TEST_EXPECTED_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'SKIPPED',
          note: '関連ステップがスキップされたため確認不可',
          judgedAt: null,
          judgedByUser: null,
          judgedByAgentName: null,
        },
      };
      mockApiClientPatch.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'update_execution_expected_result', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        status: 'SKIPPED',
        note: '関連ステップがスキップされたため確認不可',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.expectedResult.status).toBe('SKIPPED');
      expect(parsed.expectedResult.note).toBe('関連ステップがスキップされたため確認不可');
    });
  });

  describe('upload_execution_evidence', () => {
    it('presigned URLを取得して構造化データを返す', async () => {
      const mockResponse = {
        evidenceId: TEST_EVIDENCE_ID,
        uploadUrl: 'https://minio.example.com/presigned-put-url',
      };
      mockApiClientPost.mockResolvedValueOnce(mockResponse);

      const response = await callMcpTool(app, sessionId, 'upload_execution_evidence', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        filePath: '/tmp/screenshot.png',
        description: 'ログイン画面のスクリーンショット',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.evidenceId).toBe(TEST_EVIDENCE_ID);
      expect(parsed.uploadUrl).toBe('https://minio.example.com/presigned-put-url');
      expect(parsed.filePath).toBe('/tmp/screenshot.png');
      expect(parsed.contentType).toBe('image/png');
      expect(parsed.message).toContain('presigned URL');

      // ファイルアクセスしないこと
      expect(mockFsReadFile).not.toHaveBeenCalled();

      // JSON POSTで送信されること（multipartではない）
      expect(mockApiClientPost).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}/evidences/upload-url`,
        {
          fileName: 'screenshot.png',
          fileType: 'image/png',
          description: 'ログイン画面のスクリーンショット',
        },
        { userId: testUser.id }
      );
    });
  });

  describe('存在しないエンティティへの操作エラー', () => {
    it('存在しない実行IDでの前提条件結果更新がエラーを返す', async () => {
      const nonExistentExecutionId = '99999999-9999-9999-9999-999999999999';
      mockApiClientPatch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Execution not found')
      );

      const response = await callMcpTool(app, sessionId, 'update_execution_precondition_result', {
        executionId: nonExistentExecutionId,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('エラー');
      expect(result.content[0].text).toContain('404');
    });

    it('存在しないステップ結果IDでの更新がエラーを返す', async () => {
      const nonExistentStepResultId = '99999999-9999-9999-9999-999999999999';
      mockApiClientPatch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Step result not found')
      );

      const response = await callMcpTool(app, sessionId, 'update_execution_step_result', {
        executionId: TEST_EXECUTION_ID,
        stepResultId: nonExistentStepResultId,
        status: 'DONE',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('エラー');
    });

    it('存在しない期待結果IDでの更新がエラーを返す', async () => {
      const nonExistentExpectedResultId = '99999999-9999-9999-9999-999999999999';
      mockApiClientPatch.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Expected result not found')
      );

      const response = await callMcpTool(app, sessionId, 'update_execution_expected_result', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: nonExistentExpectedResultId,
        status: 'PASS',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('エラー');
    });
  });

  describe('各結果タイプの更新', () => {
    it('前提条件結果のMET/NOT_MET両方のステータスを正しく処理できる', async () => {
      // METステータス
      mockApiClientPatch.mockResolvedValueOnce({
        preconditionResult: {
          id: TEST_PRECONDITION_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'MET',
          note: null,
          checkedAt: '2025-01-01T00:00:00.000Z',
          checkedByUser: null,
          checkedByAgentName: null,
        },
      });

      const metResponse = await callMcpTool(
        app,
        sessionId,
        'update_execution_precondition_result',
        {
          executionId: TEST_EXECUTION_ID,
          preconditionResultId: TEST_PRECONDITION_RESULT_ID,
          status: 'MET',
        }
      );

      const metResult = parseToolResult(metResponse);
      const metParsed = JSON.parse(metResult.content[0].text);
      expect(metParsed.preconditionResult.status).toBe('MET');

      // NOT_METステータス
      mockApiClientPatch.mockResolvedValueOnce({
        preconditionResult: {
          id: TEST_PRECONDITION_RESULT_ID,
          executionId: TEST_EXECUTION_ID,
          status: 'NOT_MET',
          note: '前提条件を満たしていない',
          checkedAt: '2025-01-01T00:01:00.000Z',
          checkedByUser: null,
          checkedByAgentName: null,
        },
      });

      const notMetResponse = await callMcpTool(
        app,
        sessionId,
        'update_execution_precondition_result',
        {
          executionId: TEST_EXECUTION_ID,
          preconditionResultId: TEST_PRECONDITION_RESULT_ID,
          status: 'NOT_MET',
          note: '前提条件を満たしていない',
        },
        3
      );

      const notMetResult = parseToolResult(notMetResponse);
      const notMetParsed = JSON.parse(notMetResult.content[0].text);
      expect(notMetParsed.preconditionResult.status).toBe('NOT_MET');
    });

    it('期待結果のPASS/FAIL/SKIPPEDすべてのステータスを正しく処理できる', async () => {
      const statuses = ['PASS', 'FAIL', 'SKIPPED'] as const;

      for (let i = 0; i < statuses.length; i++) {
        const status = statuses[i];
        mockApiClientPatch.mockResolvedValueOnce({
          expectedResult: {
            id: TEST_EXPECTED_RESULT_ID,
            executionId: TEST_EXECUTION_ID,
            status,
            note: null,
            judgedAt: status !== 'SKIPPED' ? '2025-01-01T00:00:00.000Z' : null,
            judgedByUser: null,
            judgedByAgentName: null,
          },
        });

        const response = await callMcpTool(
          app,
          sessionId,
          'update_execution_expected_result',
          {
            executionId: TEST_EXECUTION_ID,
            expectedResultId: TEST_EXPECTED_RESULT_ID,
            status,
          },
          10 + i
        );

        expect(response.status).toBe(200);
        const result = parseToolResult(response);
        const parsed = JSON.parse(result.content[0].text);
        expect(parsed.expectedResult.status).toBe(status);
      }
    });
  });
});
