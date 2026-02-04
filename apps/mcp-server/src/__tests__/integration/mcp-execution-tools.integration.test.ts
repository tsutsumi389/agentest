import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  cleanupTestData,
} from './test-helpers.js';
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

// apiClientモック
const mockApiClientGet = vi.fn();
const mockApiClientPost = vi.fn();
const mockApiClientPatch = vi.fn();

vi.mock('../../clients/api-client.js', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiClientGet(...args),
    post: (...args: unknown[]) => mockApiClientPost(...args),
    patch: (...args: unknown[]) => mockApiClientPatch(...args),
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

/**
 * MCPプロトコルでinitializeしてセッションIDを取得するヘルパー
 */
async function initializeMcpSession(app: Express, projectId: string): Promise<string> {
  const response = await request(app)
    .post('/mcp')
    .set('Cookie', 'access_token=valid-test-token')
    .set('X-MCP-Project-Id', projectId)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream')
    .send({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        clientInfo: { name: 'test-client', version: '1.0.0' },
        capabilities: {},
      },
      id: 1,
    });

  const sessionId = response.headers['mcp-session-id'];
  return sessionId;
}

/**
 * MCPツールを呼び出すヘルパー
 */
async function callMcpTool(
  app: Express,
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  requestId: number = 2
) {
  const response = await request(app)
    .post('/mcp')
    .set('Cookie', 'access_token=valid-test-token')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream')
    .set('Mcp-Session-Id', sessionId)
    .send({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: requestId,
    });

  return response;
}

/**
 * SSEレスポンスからJSON-RPCメッセージを抽出するヘルパー
 * MCP SDK v1.25.1ではツール呼び出しの応答がSSE(text/event-stream)で返されるため、
 * response.bodyではなくresponse.textからSSEイベントデータをパースする必要がある
 */
function extractJsonRpcFromSse(response: request.Response): Record<string, unknown> | null {
  // まずbodyにJSON-RPCレスポンスがある場合（JSONモードの場合）
  if (response.body && typeof response.body === 'object' && ('result' in response.body || 'error' in response.body)) {
    return response.body as Record<string, unknown>;
  }
  // SSEレスポンスからJSON-RPCメッセージを抽出
  const text = response.text;
  if (!text) return null;
  const dataLines = text.split('\n').filter((line: string) => line.startsWith('data: '));
  for (const line of dataLines) {
    const jsonStr = line.slice(6);
    if (!jsonStr.trim()) continue;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && (parsed.result !== undefined || parsed.error !== undefined)) {
        return parsed;
      }
    } catch {
      // パース失敗は無視
    }
  }
  return null;
}

/**
 * MCPレスポンスからツール結果のJSONをパースするヘルパー
 */
function parseToolResult(response: request.Response): { content: Array<{ type: string; text: string }>; isError?: boolean } {
  const jsonRpc = extractJsonRpcFromSse(response);
  if (jsonRpc?.result) {
    return jsonRpc.result as { content: Array<{ type: string; text: string }>; isError?: boolean };
  }
  // JSON-RPCレベルのエラーの場合、エラー内容をcontentとして返す
  if (jsonRpc?.error) {
    const error = jsonRpc.error as { message?: string; data?: string };
    return {
      content: [{ type: 'text', text: error.message ?? error.data ?? 'Unknown error' }],
      isError: true,
    };
  }
  return { content: [], isError: undefined };
}

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
    sessionId = await initializeMcpSession(app, testProject.id);
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
        { status: 'MET', note: 'データベースが初期化済みであることを確認', agentName: 'Claude Code Opus4.5' },
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
    it('エビデンスファイルを正常にアップロードできる', async () => {
      const mockResponse = {
        evidence: {
          id: TEST_EVIDENCE_ID,
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'screenshot.png',
          fileUrl: 'https://storage.example.com/evidences/screenshot.png',
          fileType: 'image/png',
          fileSize: 12345,
          description: 'ログイン画面のスクリーンショット',
          uploadedByUserId: testUser.id,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      };
      mockApiClientPost.mockResolvedValueOnce(mockResponse);

      // Base64エンコードされたテストデータ
      const testFileData = Buffer.from('test-image-data').toString('base64');

      const response = await callMcpTool(app, sessionId, 'upload_execution_evidence', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'screenshot.png',
        fileData: testFileData,
        fileType: 'image/png',
        description: 'ログイン画面のスクリーンショット',
      });

      expect(response.status).toBe(200);
      const result = parseToolResult(response);
      expect(result.isError).toBeUndefined();

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.evidence.id).toBe(TEST_EVIDENCE_ID);
      expect(parsed.evidence.fileName).toBe('screenshot.png');
      expect(parsed.evidence.fileType).toBe('image/png');
      expect(parsed.evidence.description).toBe('ログイン画面のスクリーンショット');

      expect(mockApiClientPost).toHaveBeenCalledWith(
        `/internal/api/executions/${TEST_EXECUTION_ID}/expected-results/${TEST_EXPECTED_RESULT_ID}/evidences`,
        {
          fileName: 'screenshot.png',
          fileData: testFileData,
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

      const metResponse = await callMcpTool(app, sessionId, 'update_execution_precondition_result', {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'MET',
      });

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

      const notMetResponse = await callMcpTool(app, sessionId, 'update_execution_precondition_result', {
        executionId: TEST_EXECUTION_ID,
        preconditionResultId: TEST_PRECONDITION_RESULT_ID,
        status: 'NOT_MET',
        note: '前提条件を満たしていない',
      }, 3);

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
