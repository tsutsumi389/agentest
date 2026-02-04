import { vi } from 'vitest';

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
