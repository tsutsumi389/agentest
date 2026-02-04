import { vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

/**
 * MCPツールテスト用のヘルパー
 * apiClientのモックファクトリ、認証コンテキスト設定、テストデータファクトリを提供
 */

// テストヘルパーからcleanupTestDataを再エクスポート
export { cleanupTestData } from './test-helpers.js';

// --- apiClientモック用の型定義 ---

/**
 * パスベースのモックレスポンス設定
 * キーはURLパスの部分一致文字列、値はそのパスにマッチしたときに返すデータ
 */
export type MockResponseMap = Record<string, unknown>;

/**
 * apiClientモックファクトリ
 * テストごとに異なるレスポンスを返せるように設定可能なモックを生成
 */
export function createApiClientMock(responseMap: MockResponseMap = {}) {
  const getMock = vi.fn().mockImplementation(async (path: string) => {
    // パスに部分一致するキーを探す
    const matchedKey = Object.keys(responseMap).find((key) => path.includes(key));
    if (matchedKey) {
      return responseMap[matchedKey];
    }
    // マッチしない場合はデフォルトの空レスポンス
    return { data: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } };
  });

  const postMock = vi.fn().mockImplementation(async () => ({}));
  const patchMock = vi.fn().mockImplementation(async () => ({}));
  const deleteMock = vi.fn().mockImplementation(async () => ({}));

  return {
    apiClient: {
      get: getMock,
      post: postMock,
      patch: patchMock,
      delete: deleteMock,
    },
    getMock,
    postMock,
    patchMock,
    deleteMock,
  };
}

/**
 * apiClientのgetモックをエラーを投げるように設定
 */
export function createApiClientErrorMock(errorMessage: string, statusCode: number = 500) {
  const error = new Error(`Internal API error: ${statusCode} - ${errorMessage}`);
  const getMock = vi.fn().mockRejectedValue(error);

  return {
    apiClient: {
      get: getMock,
      post: vi.fn().mockRejectedValue(error),
      patch: vi.fn().mockRejectedValue(error),
      delete: vi.fn().mockRejectedValue(error),
    },
    getMock,
  };
}

// --- 認証コンテキストヘルパー ---

/**
 * テスト用認証状態の型
 */
export interface TestAuthState {
  mockAuthUser: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    deletedAt: Date | null;
  } | null;
  mockVerifyAccessTokenResult: { sub: string; email: string } | null;
  mockVerifyAccessTokenError: Error | null;
}

/**
 * テスト用のデフォルト認証ユーザー情報を生成
 */
export function createTestAuthUser(overrides: Partial<TestAuthState['mockAuthUser']> = {}) {
  return {
    id: overrides?.id ?? 'test-user-001',
    email: overrides?.email ?? 'mcp-tools-test@example.com',
    name: overrides?.name ?? 'MCP Tools Test User',
    avatarUrl: overrides?.avatarUrl ?? null,
    deletedAt: overrides?.deletedAt ?? null,
  };
}

// --- テストデータファクトリ ---

/**
 * プロジェクト検索レスポンスのファクトリ
 */
export function createProjectSearchResponse(
  overrides: {
    projects?: Array<Record<string, unknown>>;
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  } = {}
) {
  const projects = overrides.projects ?? [
    {
      id: 'proj-001',
      name: 'テストプロジェクト1',
      description: 'プロジェクト1の説明',
      organizationId: 'org-001',
      organization: { id: 'org-001', name: 'テスト組織' },
      role: 'OWNER',
      _count: { testSuites: 3 },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
    {
      id: 'proj-002',
      name: 'テストプロジェクト2',
      description: null,
      organizationId: null,
      organization: null,
      role: 'MEMBER',
      _count: { testSuites: 1 },
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-04T00:00:00.000Z',
    },
  ];

  return {
    projects,
    pagination: {
      total: overrides.total ?? projects.length,
      limit: overrides.limit ?? 50,
      offset: overrides.offset ?? 0,
      hasMore: overrides.hasMore ?? false,
    },
  };
}

/**
 * テストスイート検索レスポンスのファクトリ
 */
export function createTestSuiteSearchResponse(
  overrides: {
    testSuites?: Array<Record<string, unknown>>;
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  } = {}
) {
  const testSuites = overrides.testSuites ?? [
    {
      id: 'suite-001',
      name: 'ログインテストスイート',
      description: 'ログイン機能のテスト',
      status: 'ACTIVE',
      projectId: 'proj-001',
      project: { id: 'proj-001', name: 'テストプロジェクト1' },
      createdByUser: { id: 'test-user-001', name: 'MCP Tools Test User', avatarUrl: null },
      _count: { testCases: 5, preconditions: 2 },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
  ];

  return {
    testSuites,
    pagination: {
      total: overrides.total ?? testSuites.length,
      limit: overrides.limit ?? 20,
      offset: overrides.offset ?? 0,
      hasMore: overrides.hasMore ?? false,
    },
  };
}

/**
 * テストケース検索レスポンスのファクトリ
 */
export function createTestCaseSearchResponse(
  overrides: {
    testCases?: Array<Record<string, unknown>>;
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  } = {}
) {
  const testCases = overrides.testCases ?? [
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
    {
      id: 'case-002',
      testSuiteId: 'suite-001',
      title: '異常ログインテスト',
      description: '不正な資格情報でエラーが表示されること',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      orderKey: 'a1',
      createdByUser: { id: 'test-user-001', name: 'MCP Tools Test User', avatarUrl: null },
      _count: { preconditions: 1, steps: 3, expectedResults: 1 },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
  ];

  return {
    testCases,
    pagination: {
      total: overrides.total ?? testCases.length,
      limit: overrides.limit ?? 20,
      offset: overrides.offset ?? 0,
      hasMore: overrides.hasMore ?? false,
    },
  };
}

/**
 * 実行履歴検索レスポンスのファクトリ
 */
export function createExecutionSearchResponse(
  overrides: {
    executions?: Array<Record<string, unknown>>;
    total?: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
  } = {}
) {
  const executions = overrides.executions ?? [
    {
      id: 'exec-001',
      testSuiteId: 'suite-001',
      executedByUser: { id: 'test-user-001', name: 'MCP Tools Test User', avatarUrl: null },
      environment: { id: 'env-001', name: 'ステージング' },
      createdAt: '2024-01-10T00:00:00.000Z',
      updatedAt: '2024-01-10T01:00:00.000Z',
    },
  ];

  return {
    executions,
    pagination: {
      total: overrides.total ?? executions.length,
      limit: overrides.limit ?? 20,
      offset: overrides.offset ?? 0,
      hasMore: overrides.hasMore ?? false,
    },
  };
}

/**
 * 空のページネーションレスポンスを生成
 */
export function createEmptyResponse(dataKey: string, limit: number = 20) {
  return {
    [dataKey]: [],
    pagination: {
      total: 0,
      limit,
      offset: 0,
      hasMore: false,
    },
  };
}

// --- MCP プロトコルヘルパー ---

/**
 * MCP初期化リクエストを生成
 */
export function createMcpInitializeRequest(id: number = 1) {
  return {
    jsonrpc: '2.0',
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      clientInfo: { name: 'test-client', version: '1.0.0' },
      capabilities: {},
    },
    id,
  };
}

/**
 * MCPツール呼び出しリクエストを生成
 */
export function createMcpToolCallRequest(
  toolName: string,
  args: Record<string, unknown> = {},
  id: number = 2
) {
  return {
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
    id,
  };
}

// --- SSE/JSON-RPC共有ヘルパー ---

/**
 * SSEレスポンスからJSON-RPCメッセージを抽出する
 * MCP SDK v1.25.1ではツール呼び出しの応答がSSE(text/event-stream)で返されるため、
 * response.bodyではなくresponse.textからSSEイベントデータをパースする必要がある
 */
export function extractJsonRpcFromSse(response: request.Response): Record<string, unknown> | null {
  // まずbodyにJSON-RPCレスポンスがある場合（JSONモードの場合）
  if (response.body && typeof response.body === 'object' && ('result' in response.body || 'error' in response.body)) {
    return response.body as Record<string, unknown>;
  }
  // SSEレスポンスからJSON-RPCメッセージを抽出
  const text = response.text;
  if (!text) return null;
  // SSEフォーマット: "event: message\ndata: {JSON}\n\n" を解析
  const dataLines = text.split('\n').filter((line: string) => line.startsWith('data: '));
  for (const line of dataLines) {
    const jsonStr = line.slice(6); // "data: " を除去
    if (!jsonStr.trim()) continue;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && (parsed.result !== undefined || parsed.error !== undefined)) {
        return parsed;
      }
    } catch {
      // パース失敗は無視して次の行へ
    }
  }
  return null;
}

/**
 * MCPツール応答のcontentテキストをJSON.parseして返す
 * crud-tools, search-tools向け
 */
export function parseToolResultJson(response: request.Response): unknown {
  const jsonRpc = extractJsonRpcFromSse(response);
  const result = jsonRpc?.result as { content?: Array<{ type: string; text: string }>; isError?: boolean } | undefined;
  if (!result?.content?.[0]?.text) return null;
  try {
    return JSON.parse(result.content[0].text);
  } catch {
    return result.content[0].text;
  }
}

/**
 * MCPツール応答のresultオブジェクトをそのまま返す
 * execution-tools, workflow向け
 */
export function parseToolResultRaw(response: request.Response): { content: Array<{ type: string; text: string }>; isError?: boolean } {
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

/**
 * MCPツール応答がエラー（JSON-RPCレベルまたはツールレベル）かどうかを判定
 * レスポンスがJSON-RPCとして解析できない場合はfalseを返す
 */
export function isToolError(response: request.Response): boolean {
  const jsonRpc = extractJsonRpcFromSse(response);
  if (!jsonRpc) return false;
  // JSON-RPCレベルのエラー
  if (jsonRpc.error !== undefined) return true;
  // ツールレベルのisErrorフラグ
  const result = jsonRpc.result as { isError?: boolean } | undefined;
  return result?.isError === true;
}

/**
 * MCPツール応答のcontentテキストを直接取得する
 */
export function getToolContentText(response: request.Response): string {
  const jsonRpc = extractJsonRpcFromSse(response);
  const result = jsonRpc?.result as { content?: Array<{ type: string; text: string }> } | undefined;
  return result?.content?.[0]?.text ?? '';
}

/**
 * MCPツール応答のエラーメッセージを取得する
 */
export function getToolErrorMessage(response: request.Response): string {
  const jsonRpc = extractJsonRpcFromSse(response);
  if (!jsonRpc) return '';
  // JSON-RPCレベルのエラー
  if (jsonRpc.error) {
    const error = jsonRpc.error as { message?: string; data?: string };
    return error.message ?? error.data ?? '';
  }
  // ツールレベルのエラー
  const result = jsonRpc.result as { content?: Array<{ type: string; text: string }> } | undefined;
  return result?.content?.[0]?.text ?? '';
}

// --- MCPセッション・ツール呼び出し共有ヘルパー ---

/**
 * MCPセッション初期化のオプション
 */
export interface InitializeSessionOptions {
  projectId?: string;
  clientId?: string;
  clientName?: string;
}

/**
 * MCPセッションを初期化してセッションIDを取得する
 */
export async function initializeMcpSession(
  app: Express,
  options?: InitializeSessionOptions
): Promise<string> {
  const req = request(app)
    .post('/mcp')
    .set('Cookie', 'access_token=valid-test-token')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream');

  if (options?.projectId) {
    req.set('X-MCP-Project-Id', options.projectId);
  }
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

  if (response.status !== 200) {
    throw new Error(
      `MCPセッション初期化失敗: HTTP ${response.status} (body: ${JSON.stringify(response.body)})`
    );
  }

  const sessionId = response.headers['mcp-session-id'];
  if (!sessionId || typeof sessionId !== 'string') {
    throw new Error(
      `MCPセッション初期化失敗: mcp-session-idヘッダーが返されませんでした (status: ${response.status})`
    );
  }

  return sessionId;
}

/**
 * MCPツールを呼び出す
 */
export async function callMcpTool(
  app: Express,
  sessionId: string,
  toolName: string,
  args: Record<string, unknown> = {},
  requestId: number = 2
): Promise<request.Response> {
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
