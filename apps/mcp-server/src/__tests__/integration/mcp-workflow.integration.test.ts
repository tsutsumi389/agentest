import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '@agentest/db';
import {
  createTestUser,
  createTestProject,
  createTestAgentSession,
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
const mockApiClientDelete = vi.fn();

vi.mock('../../clients/api-client.js', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockApiClientGet(...args),
    post: (...args: unknown[]) => mockApiClientPost(...args),
    patch: (...args: unknown[]) => mockApiClientPatch(...args),
    delete: (...args: unknown[]) => mockApiClientDelete(...args),
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
const TEST_PROJECT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TEST_SUITE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEST_CASE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const TEST_EXECUTION_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const TEST_PRECONDITION_RESULT_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const TEST_STEP_RESULT_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
const TEST_EXPECTED_RESULT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_EVIDENCE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_EXEC_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_EXEC_CASE_ID = '44444444-4444-4444-4444-444444444444';

/**
 * MCPプロトコルでinitializeしてセッションIDを取得するヘルパー
 */
async function initializeMcpSession(
  app: Express,
  projectId: string,
  options?: { clientId?: string; clientName?: string }
): Promise<string> {
  const req = request(app)
    .post('/mcp')
    .set('Cookie', 'access_token=valid-test-token')
    .set('X-MCP-Project-Id', projectId)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream');

  if (options?.clientId) {
    req.set('X-MCP-Client-Id', options.clientId);
  }
  if (options?.clientName) {
    req.set('X-MCP-Client-Name', options.clientName);
  }

  const response = await req.send({
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

describe('MCPワークフロー統合テスト', () => {
  let app: Express;
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let testProject: Awaited<ReturnType<typeof createTestProject>>;

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
      email: 'workflow-test@example.com',
      name: 'Workflow Test User',
    });
    testProject = await createTestProject(testUser.id, {
      name: 'Workflow Test Project',
    });

    // 認証を設定
    setTestAuth({
      id: testUser.id,
      email: testUser.email,
      name: testUser.name,
      avatarUrl: null,
      deletedAt: null,
    });
  });

  describe('E2Eシナリオ: 検索→テストスイート作成→テストケース作成→実行作成→結果入力', () => {
    it('プロジェクト検索からテスト結果入力までの一連の操作が完了できる', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      // ステップ1: プロジェクト検索
      mockApiClientGet.mockResolvedValueOnce({
        projects: [{
          id: TEST_PROJECT_ID,
          name: 'テストプロジェクト',
          description: 'E2Eテスト用プロジェクト',
          organizationId: null,
          organization: null,
          role: 'OWNER',
          _count: { testSuites: 0 },
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      });

      const searchProjectResponse = await callMcpTool(app, sessionId, 'search_project', {}, 2);
      expect(searchProjectResponse.status).toBe(200);
      const searchProjectResult = parseToolResult(searchProjectResponse);
      const projects = JSON.parse(searchProjectResult.content[0].text);
      expect(projects.projects).toHaveLength(1);
      const projectId = projects.projects[0].id;

      // ステップ2: テストスイート作成
      mockApiClientPost.mockResolvedValueOnce({
        testSuite: {
          id: TEST_SUITE_ID,
          projectId,
          name: 'ログイン機能テストスイート',
          description: 'ログイン機能に関するテストケース群',
          status: 'ACTIVE',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const createSuiteResponse = await callMcpTool(app, sessionId, 'create_test_suite', {
        projectId,
        name: 'ログイン機能テストスイート',
        description: 'ログイン機能に関するテストケース群',
        status: 'ACTIVE',
      }, 3);
      expect(createSuiteResponse.status).toBe(200);
      const suiteResult = parseToolResult(createSuiteResponse);
      const suite = JSON.parse(suiteResult.content[0].text);
      const testSuiteId = suite.testSuite.id;

      // ステップ3: テストケース作成
      mockApiClientPost.mockResolvedValueOnce({
        testCase: {
          id: TEST_CASE_ID,
          testSuiteId,
          title: '正常ログインテスト',
          description: '有効な認証情報でログインできることを確認',
          priority: 'HIGH',
          status: 'ACTIVE',
          orderKey: 'a',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
          preconditions: [{ id: 'pre-1', content: 'ユーザーアカウントが存在すること', orderKey: 'a' }],
          steps: [
            { id: 'step-1', content: 'ログインページを開く', orderKey: 'a' },
            { id: 'step-2', content: 'メールアドレスを入力する', orderKey: 'b' },
          ],
          expectedResults: [
            { id: 'er-1', content: 'ダッシュボードページに遷移すること', orderKey: 'a' },
          ],
        },
      });

      const createCaseResponse = await callMcpTool(app, sessionId, 'create_test_case', {
        testSuiteId,
        title: '正常ログインテスト',
        description: '有効な認証情報でログインできることを確認',
        priority: 'HIGH',
        status: 'ACTIVE',
        preconditions: [{ content: 'ユーザーアカウントが存在すること' }],
        steps: [
          { content: 'ログインページを開く' },
          { content: 'メールアドレスを入力する' },
        ],
        expectedResults: [{ content: 'ダッシュボードページに遷移すること' }],
      }, 4);
      expect(createCaseResponse.status).toBe(200);

      // ステップ4: 実行作成
      mockApiClientPost.mockResolvedValueOnce({
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId,
          environmentId: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const createExecResponse = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId,
      }, 5);
      expect(createExecResponse.status).toBe(200);
      const execResult = parseToolResult(createExecResponse);
      const execution = JSON.parse(execResult.content[0].text);
      const executionId = execution.execution.id;

      // ステップ5: 実行詳細取得（結果IDを取得）
      mockApiClientGet.mockResolvedValueOnce({
        execution: {
          id: executionId,
          testSuiteId,
          testSuite: { id: testSuiteId, name: 'ログイン機能テストスイート', projectId },
          executedByUser: { id: testUser.id, name: testUser.name, avatarUrl: null },
          environment: null,
          executionTestSuite: {
            id: TEST_EXEC_SUITE_ID,
            executionId,
            originalTestSuiteId: testSuiteId,
            name: 'ログイン機能テストスイート',
            description: null,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            preconditions: [],
            testCases: [{
              id: TEST_EXEC_CASE_ID,
              executionTestSuiteId: TEST_EXEC_SUITE_ID,
              originalTestCaseId: TEST_CASE_ID,
              title: '正常ログインテスト',
              description: null,
              priority: 'HIGH',
              orderKey: 'a',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
              preconditions: [],
              steps: [{ id: 'exec-step-1', executionTestCaseId: TEST_EXEC_CASE_ID, originalStepId: 'step-1', content: 'ログインページを開く', orderKey: 'a', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }],
              expectedResults: [{ id: 'exec-er-1', executionTestCaseId: TEST_EXEC_CASE_ID, originalExpectedResultId: 'er-1', content: 'ダッシュボードページに遷移すること', orderKey: 'a', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }],
            }],
          },
          preconditionResults: [{
            id: TEST_PRECONDITION_RESULT_ID,
            executionId,
            executionTestCaseId: TEST_EXEC_CASE_ID,
            executionSuitePreconditionId: null,
            executionCasePreconditionId: null,
            status: 'PENDING',
            note: null,
            checkedAt: null,
            suitePrecondition: null,
            casePrecondition: null,
            executionTestCase: null,
          }],
          stepResults: [{
            id: TEST_STEP_RESULT_ID,
            executionId,
            executionTestCaseId: TEST_EXEC_CASE_ID,
            executionStepId: 'exec-step-1',
            status: 'PENDING',
            note: null,
            executedAt: null,
            executionStep: { id: 'exec-step-1', executionTestCaseId: TEST_EXEC_CASE_ID, originalStepId: 'step-1', content: 'ログインページを開く', orderKey: 'a', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
            executionTestCase: { id: TEST_EXEC_CASE_ID, executionTestSuiteId: TEST_EXEC_SUITE_ID, originalTestCaseId: TEST_CASE_ID, title: '正常ログインテスト', description: null, priority: 'HIGH', orderKey: 'a', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
          }],
          expectedResults: [{
            id: TEST_EXPECTED_RESULT_ID,
            executionId,
            executionTestCaseId: TEST_EXEC_CASE_ID,
            executionExpectedResultId: 'exec-er-1',
            status: 'PENDING',
            note: null,
            judgedAt: null,
            executionExpectedResult: { id: 'exec-er-1', executionTestCaseId: TEST_EXEC_CASE_ID, originalExpectedResultId: 'er-1', content: 'ダッシュボードページに遷移すること', orderKey: 'a', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
            executionTestCase: { id: TEST_EXEC_CASE_ID, executionTestSuiteId: TEST_EXEC_SUITE_ID, originalTestCaseId: TEST_CASE_ID, title: '正常ログインテスト', description: null, priority: 'HIGH', orderKey: 'a', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
            evidences: [],
          }],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const getExecResponse = await callMcpTool(app, sessionId, 'get_execution', {
        executionId,
      }, 6);
      expect(getExecResponse.status).toBe(200);
      const execDetail = JSON.parse(parseToolResult(getExecResponse).content[0].text);

      // ステップ6: 前提条件結果を更新
      const preconditionResultId = execDetail.execution.preconditionResults[0].id;
      mockApiClientPatch.mockResolvedValueOnce({
        preconditionResult: {
          id: preconditionResultId,
          executionId,
          status: 'MET',
          note: '確認済み',
          checkedAt: '2025-01-01T00:01:00.000Z',
          checkedByUser: null,
          checkedByAgentName: 'Claude Code Opus4.5',
        },
      });

      const updatePrecondResponse = await callMcpTool(app, sessionId, 'update_execution_precondition_result', {
        executionId,
        preconditionResultId,
        status: 'MET',
        note: '確認済み',
        agentName: 'Claude Code Opus4.5',
      }, 7);
      expect(updatePrecondResponse.status).toBe(200);

      // ステップ7: ステップ結果を更新
      const stepResultId = execDetail.execution.stepResults[0].id;
      mockApiClientPatch.mockResolvedValueOnce({
        stepResult: {
          id: stepResultId,
          executionId,
          status: 'DONE',
          note: '正常に実行完了',
          executedAt: '2025-01-01T00:02:00.000Z',
          executedByUser: null,
          executedByAgentName: 'Claude Code Opus4.5',
        },
      });

      const updateStepResponse = await callMcpTool(app, sessionId, 'update_execution_step_result', {
        executionId,
        stepResultId,
        status: 'DONE',
        note: '正常に実行完了',
        agentName: 'Claude Code Opus4.5',
      }, 8);
      expect(updateStepResponse.status).toBe(200);

      // ステップ8: 期待結果を更新
      const expectedResultId = execDetail.execution.expectedResults[0].id;
      mockApiClientPatch.mockResolvedValueOnce({
        expectedResult: {
          id: expectedResultId,
          executionId,
          status: 'PASS',
          note: '期待通りの結果',
          judgedAt: '2025-01-01T00:03:00.000Z',
          judgedByUser: null,
          judgedByAgentName: 'Claude Code Opus4.5',
        },
      });

      const updateExpectedResponse = await callMcpTool(app, sessionId, 'update_execution_expected_result', {
        executionId,
        expectedResultId,
        status: 'PASS',
        note: '期待通りの結果',
        agentName: 'Claude Code Opus4.5',
      }, 9);
      expect(updateExpectedResponse.status).toBe(200);
      const finalResult = parseToolResult(updateExpectedResponse);
      const finalParsed = JSON.parse(finalResult.content[0].text);
      expect(finalParsed.expectedResult.status).toBe('PASS');

      // すべてのAPI呼び出しが正しい順序で行われたことを確認
      expect(mockApiClientGet).toHaveBeenCalledTimes(2); // search_project + get_execution
      expect(mockApiClientPost).toHaveBeenCalledTimes(3); // create_test_suite + create_test_case + create_execution
      expect(mockApiClientPatch).toHaveBeenCalledTimes(3); // precondition + step + expected
    });

    it('テストスイート検索→実行作成→結果入力の短縮ワークフローが完了できる', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      // テストスイート検索
      mockApiClientGet.mockResolvedValueOnce({
        testSuites: [{
          id: TEST_SUITE_ID,
          name: '既存テストスイート',
          description: null,
          status: 'ACTIVE',
          projectId: TEST_PROJECT_ID,
          project: { id: TEST_PROJECT_ID, name: 'テストプロジェクト' },
          createdByUser: null,
          _count: { testCases: 3, preconditions: 1 },
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }],
        pagination: { total: 1, limit: 20, offset: 0, hasMore: false },
      });

      const searchResponse = await callMcpTool(app, sessionId, 'search_test_suite', {
        projectId: TEST_PROJECT_ID,
        q: '既存テスト',
      }, 2);
      expect(searchResponse.status).toBe(200);
      const searchResult = JSON.parse(parseToolResult(searchResponse).content[0].text);
      const suiteId = searchResult.testSuites[0].id;

      // 実行作成
      mockApiClientPost.mockResolvedValueOnce({
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: suiteId,
          environmentId: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const execResponse = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId: suiteId,
      }, 3);
      expect(execResponse.status).toBe(200);
      const execParsed = JSON.parse(parseToolResult(execResponse).content[0].text);
      expect(execParsed.execution.testSuiteId).toBe(suiteId);
    });
  });

  describe('セッション管理', () => {
    it('セッション作成→ハートビート→終了の一連の流れが正常に動作する', async () => {
      const clientId = 'workflow-session-client';
      const clientName = 'Workflow Session Client';

      // セッション作成（initialize）
      const sessionId = await initializeMcpSession(app, testProject.id, {
        clientId,
        clientName,
      });
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');

      // セッションがDBに作成されたことを確認
      const session = await prisma.agentSession.findFirst({
        where: {
          projectId: testProject.id,
          clientId,
          status: 'ACTIVE',
        },
      });
      expect(session).toBeDefined();
      expect(session?.clientName).toBe(clientName);

      // ハートビート更新（ツール呼び出しで暗黙的に更新される）
      mockApiClientGet.mockResolvedValueOnce({
        projects: [],
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
      });

      const heartbeatResponse = await callMcpTool(app, sessionId, 'search_project', {}, 2);
      expect(heartbeatResponse.status).toBe(200);

      // ハートビートが更新されたことを確認
      const updatedSession = await prisma.agentSession.findFirst({
        where: {
          projectId: testProject.id,
          clientId,
          status: 'ACTIVE',
        },
      });
      expect(updatedSession).toBeDefined();
      if (session && updatedSession) {
        expect(updatedSession.lastHeartbeat.getTime()).toBeGreaterThanOrEqual(
          session.lastHeartbeat.getTime()
        );
      }

      // セッション終了（DELETE）
      const deleteResponse = await request(app)
        .delete('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('Mcp-Session-Id', sessionId)
        .set('X-MCP-Client-Id', clientId)
        .set('X-MCP-Project-Id', testProject.id);

      // DELETEリクエストが処理されたことを確認（200 or 202）
      expect([200, 202, 204].includes(deleteResponse.status)).toBe(true);
    });

    it('初期化なしのツール呼び出しがエラーを返す', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .set('Mcp-Session-Id', 'non-existent-session-id')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'search_project',
            arguments: {},
          },
          id: 1,
        });

      // セッションが見つからないため400エラー
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('セッションIDなしでinitialize以外のメソッドを呼ぶとエラーになる', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('Content-Type', 'application/json')
        .set('Accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: {
            name: 'search_project',
            arguments: {},
          },
          id: 1,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('複数ツールの連続呼び出し時のコンテキスト保持', () => {
    it('同一セッション内で複数のツールを順次呼び出しても認証コンテキストが保持される', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      // 1回目: プロジェクト検索
      mockApiClientGet.mockResolvedValueOnce({
        projects: [{
          id: TEST_PROJECT_ID,
          name: 'テストプロジェクト',
          description: null,
          organizationId: null,
          organization: null,
          role: 'OWNER',
          _count: { testSuites: 1 },
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      });

      const response1 = await callMcpTool(app, sessionId, 'search_project', {}, 2);
      expect(response1.status).toBe(200);
      expect(parseToolResult(response1).isError).toBeUndefined();

      // apiClientにuserIdが渡されたことを確認
      expect(mockApiClientGet).toHaveBeenCalledWith(
        expect.stringContaining(`/internal/api/users/${testUser.id}/projects`),
        expect.any(Object)
      );

      // 2回目: テストスイート検索
      mockApiClientGet.mockResolvedValueOnce({
        testSuites: [],
        pagination: { total: 0, limit: 20, offset: 0, hasMore: false },
      });

      const response2 = await callMcpTool(app, sessionId, 'search_test_suite', {
        projectId: TEST_PROJECT_ID,
      }, 3);
      expect(response2.status).toBe(200);
      expect(parseToolResult(response2).isError).toBeUndefined();

      // 2回目の呼び出しでもuserIdが正しいことを確認
      expect(mockApiClientGet).toHaveBeenCalledWith(
        expect.stringContaining(`/internal/api/users/${testUser.id}/test-suites`),
        expect.any(Object)
      );

      // 3回目: テストスイート作成
      mockApiClientPost.mockResolvedValueOnce({
        testSuite: {
          id: TEST_SUITE_ID,
          projectId: TEST_PROJECT_ID,
          name: '新規テストスイート',
          description: null,
          status: 'DRAFT',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const response3 = await callMcpTool(app, sessionId, 'create_test_suite', {
        projectId: TEST_PROJECT_ID,
        name: '新規テストスイート',
      }, 4);
      expect(response3.status).toBe(200);
      expect(parseToolResult(response3).isError).toBeUndefined();

      // POSTにもuserIdが正しく渡されたことを確認
      expect(mockApiClientPost).toHaveBeenCalledWith(
        '/internal/api/test-suites',
        expect.any(Object),
        { userId: testUser.id }
      );

      // 合計呼び出し回数を確認
      expect(mockApiClientGet).toHaveBeenCalledTimes(2);
      expect(mockApiClientPost).toHaveBeenCalledTimes(1);
    });

    it('異なるツールタイプ（検索・作成・更新）を混在して呼び出してもセッションが維持される', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      // 検索ツール
      mockApiClientGet.mockResolvedValueOnce({
        projects: [{ id: TEST_PROJECT_ID, name: 'P', description: null, organizationId: null, organization: null, role: 'OWNER', _count: { testSuites: 0 }, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' }],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      });
      const r1 = await callMcpTool(app, sessionId, 'search_project', {}, 2);
      expect(r1.status).toBe(200);

      // 作成ツール
      mockApiClientPost.mockResolvedValueOnce({
        testSuite: { id: TEST_SUITE_ID, projectId: TEST_PROJECT_ID, name: 'S', description: null, status: 'DRAFT', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
      });
      const r2 = await callMcpTool(app, sessionId, 'create_test_suite', { projectId: TEST_PROJECT_ID, name: 'S' }, 3);
      expect(r2.status).toBe(200);

      // 作成ツール（実行）
      mockApiClientPost.mockResolvedValueOnce({
        execution: { id: TEST_EXECUTION_ID, testSuiteId: TEST_SUITE_ID, environmentId: null, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z' },
      });
      const r3 = await callMcpTool(app, sessionId, 'create_execution', { testSuiteId: TEST_SUITE_ID }, 4);
      expect(r3.status).toBe(200);

      // 更新ツール
      mockApiClientPatch.mockResolvedValueOnce({
        stepResult: { id: TEST_STEP_RESULT_ID, executionId: TEST_EXECUTION_ID, status: 'DONE', note: null, executedAt: '2025-01-01T00:00:00.000Z', executedByUser: null, executedByAgentName: null },
      });
      const r4 = await callMcpTool(app, sessionId, 'update_execution_step_result', {
        executionId: TEST_EXECUTION_ID,
        stepResultId: TEST_STEP_RESULT_ID,
        status: 'DONE',
      }, 5);
      expect(r4.status).toBe(200);

      // すべてのレスポンスが正常であることを確認
      expect(parseToolResult(r1).isError).toBeUndefined();
      expect(parseToolResult(r2).isError).toBeUndefined();
      expect(parseToolResult(r3).isError).toBeUndefined();
      expect(parseToolResult(r4).isError).toBeUndefined();
    });
  });

  describe('エラーリカバリ: ツール失敗後の再試行', () => {
    it('APIエラー後に再試行して成功できる', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      // 1回目: APIエラー（500 Internal Server Error）
      mockApiClientPost.mockRejectedValueOnce(
        new Error('Internal API error: 500 - Internal server error')
      );

      const failedResponse = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId: TEST_SUITE_ID,
      }, 2);

      expect(failedResponse.status).toBe(200); // MCPプロトコルとしては200（エラーはコンテンツ内）
      const failedResult = parseToolResult(failedResponse);
      expect(failedResult.isError).toBe(true);
      expect(failedResult.content[0].text).toContain('エラー');

      // 2回目: 再試行で成功
      mockApiClientPost.mockResolvedValueOnce({
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          environmentId: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const retryResponse = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId: TEST_SUITE_ID,
      }, 3);

      expect(retryResponse.status).toBe(200);
      const retryResult = parseToolResult(retryResponse);
      expect(retryResult.isError).toBeUndefined();
      const parsed = JSON.parse(retryResult.content[0].text);
      expect(parsed.execution.id).toBe(TEST_EXECUTION_ID);
    });

    it('404エラー後にパラメータを変更して再試行できる', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);
      const wrongSuiteId = '99999999-9999-9999-9999-999999999999';

      // 1回目: 存在しないテストスイートIDでエラー
      mockApiClientPost.mockRejectedValueOnce(
        new Error('Internal API error: 404 - Test suite not found')
      );

      const failedResponse = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId: wrongSuiteId,
      }, 2);

      const failedResult = parseToolResult(failedResponse);
      expect(failedResult.isError).toBe(true);
      expect(failedResult.content[0].text).toContain('404');

      // 2回目: 正しいテストスイートIDで再試行
      mockApiClientPost.mockResolvedValueOnce({
        execution: {
          id: TEST_EXECUTION_ID,
          testSuiteId: TEST_SUITE_ID,
          environmentId: null,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const retryResponse = await callMcpTool(app, sessionId, 'create_execution', {
        testSuiteId: TEST_SUITE_ID,
      }, 3);

      expect(retryResponse.status).toBe(200);
      const retryResult = parseToolResult(retryResponse);
      expect(retryResult.isError).toBeUndefined();
      const parsed = JSON.parse(retryResult.content[0].text);
      expect(parsed.execution.id).toBe(TEST_EXECUTION_ID);
    });

    it('ネットワークエラー後にセッションが維持されて再試行できる', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      // 1回目: ネットワークエラー
      mockApiClientGet.mockRejectedValueOnce(
        new Error('fetch failed: ECONNREFUSED')
      );

      const failedResponse = await callMcpTool(app, sessionId, 'search_project', {}, 2);
      const failedResult = parseToolResult(failedResponse);
      expect(failedResult.isError).toBe(true);

      // 2回目: ネットワーク復旧後に同じセッションで再試行
      mockApiClientGet.mockResolvedValueOnce({
        projects: [{
          id: TEST_PROJECT_ID,
          name: 'テストプロジェクト',
          description: null,
          organizationId: null,
          organization: null,
          role: 'OWNER',
          _count: { testSuites: 0 },
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }],
        pagination: { total: 1, limit: 50, offset: 0, hasMore: false },
      });

      const retryResponse = await callMcpTool(app, sessionId, 'search_project', {}, 3);
      expect(retryResponse.status).toBe(200);
      const retryResult = parseToolResult(retryResponse);
      expect(retryResult.isError).toBeUndefined();
      const parsed = JSON.parse(retryResult.content[0].text);
      expect(parsed.projects).toHaveLength(1);
    });

    it('エビデンスアップロード失敗後に再試行して成功できる', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      const testFileData = Buffer.from('test-evidence-data').toString('base64');

      // 1回目: ストレージエラー
      mockApiClientPost.mockRejectedValueOnce(
        new Error('Internal API error: 503 - Storage service unavailable')
      );

      const failedResponse = await callMcpTool(app, sessionId, 'upload_execution_evidence', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'evidence.png',
        fileData: testFileData,
        fileType: 'image/png',
        description: 'テストエビデンス',
      }, 2);

      const failedResult = parseToolResult(failedResponse);
      expect(failedResult.isError).toBe(true);
      expect(failedResult.content[0].text).toContain('エラー');

      // 2回目: ストレージ復旧後に再試行
      mockApiClientPost.mockResolvedValueOnce({
        evidence: {
          id: TEST_EVIDENCE_ID,
          expectedResultId: TEST_EXPECTED_RESULT_ID,
          fileName: 'evidence.png',
          fileUrl: 'https://storage.example.com/evidences/evidence.png',
          fileType: 'image/png',
          fileSize: 5678,
          description: 'テストエビデンス',
          uploadedByUserId: testUser.id,
          createdAt: '2025-01-01T00:00:00.000Z',
        },
      });

      const retryResponse = await callMcpTool(app, sessionId, 'upload_execution_evidence', {
        executionId: TEST_EXECUTION_ID,
        expectedResultId: TEST_EXPECTED_RESULT_ID,
        fileName: 'evidence.png',
        fileData: testFileData,
        fileType: 'image/png',
        description: 'テストエビデンス',
      }, 3);

      expect(retryResponse.status).toBe(200);
      const retryResult = parseToolResult(retryResponse);
      expect(retryResult.isError).toBeUndefined();
      const parsed = JSON.parse(retryResult.content[0].text);
      expect(parsed.evidence.fileName).toBe('evidence.png');
    });

    it('連続したエラーの後でもセッションが破壊されず回復できる', async () => {
      const sessionId = await initializeMcpSession(app, testProject.id);

      // 3回連続でエラー
      for (let i = 0; i < 3; i++) {
        mockApiClientGet.mockRejectedValueOnce(
          new Error(`Internal API error: 503 - Service unavailable (attempt ${i + 1})`)
        );

        const errorResponse = await callMcpTool(app, sessionId, 'search_project', {}, 10 + i);
        const errorResult = parseToolResult(errorResponse);
        expect(errorResult.isError).toBe(true);
      }

      // 4回目で成功
      mockApiClientGet.mockResolvedValueOnce({
        projects: [],
        pagination: { total: 0, limit: 50, offset: 0, hasMore: false },
      });

      const successResponse = await callMcpTool(app, sessionId, 'search_project', {}, 20);
      expect(successResponse.status).toBe(200);
      const successResult = parseToolResult(successResponse);
      expect(successResult.isError).toBeUndefined();
      const parsed = JSON.parse(successResult.content[0].text);
      expect(parsed.projects).toEqual([]);
    });
  });
});
