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

function setTestAuth(user: typeof mockAuthUser, tokenPayload?: { sub: string; email: string }) {
  mockAuthUser = user;
  mockVerifyAccessTokenResult = tokenPayload ?? (user ? { sub: user.id, email: user.email } : null);
  mockVerifyAccessTokenError = null;
}

function setAuthError(error: Error) {
  mockAuthUser = null;
  mockVerifyAccessTokenResult = null;
  mockVerifyAccessTokenError = error;
}

function clearTestAuth() {
  mockAuthUser = null;
  mockVerifyAccessTokenResult = null;
  mockVerifyAccessTokenError = null;
}

describe('MCP Auth & Session Integration Tests', () => {
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
      email: 'mcp-test@example.com',
      name: 'MCP Test User',
    });
    testProject = await createTestProject(testUser.id, {
      name: 'MCP Test Project',
    });
  });

  describe('GET /health', () => {
    it('ヘルスチェックは認証不要', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'ok',
        service: 'mcp-server',
      });
    });
  });

  describe('POST /mcp - 認証', () => {
    it('認証トークンなしで401エラー', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });

    it('有効なトークンで認証成功', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: null,
        deletedAt: null,
      });

      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
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

      // MCPプロトコルの応答を確認（初期化成功）
      expect(response.status).toBe(200);
    });

    it('無効なトークンで401エラー', async () => {
      setAuthError(new Error('Invalid token'));

      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=invalid-token')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(response.status).toBe(401);
    });

    it('削除済みユーザーで401エラー', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: null,
        deletedAt: new Date(),
      });

      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /mcp - セッション管理', () => {
    beforeEach(() => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: null,
        deletedAt: null,
      });
    });

    it('X-MCP-Client-IdとX-MCP-Project-Idで新規セッション作成', async () => {
      const clientId = 'test-client-123';
      const clientName = 'Test MCP Client';

      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('X-MCP-Client-Id', clientId)
        .set('X-MCP-Client-Name', clientName)
        .set('X-MCP-Project-Id', testProject.id)
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

      expect(response.status).toBe(200);

      // DBにセッションが作成されたことを確認
      const session = await prisma.agentSession.findFirst({
        where: {
          projectId: testProject.id,
          clientId,
          status: 'ACTIVE',
        },
      });

      expect(session).toBeDefined();
      expect(session?.clientName).toBe(clientName);
    });

    it('同じクライアントIDで再リクエストすると既存セッションを使用', async () => {
      const clientId = 'test-client-existing';

      // 既存のAgentSession（DB上のセッション）を作成
      await createTestAgentSession(testProject.id, {
        clientId,
        status: 'ACTIVE',
      });

      // 注: MCPプロトコルでは初期化が必要だが、AgentSession（DB）は
      // X-MCP-Client-Id で識別されるため、initializeを呼んでも
      // 既存のAgentSessionが再利用される（新規作成されない）
      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('X-MCP-Client-Id', clientId)
        .set('X-MCP-Project-Id', testProject.id)
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

      expect(response.status).toBe(200);

      // AgentSessionは1つのみ（新規作成されていない）
      const sessions = await prisma.agentSession.findMany({
        where: {
          projectId: testProject.id,
          clientId,
          status: 'ACTIVE',
        },
      });

      expect(sessions.length).toBe(1);
    });

    it('X-MCP-Client-Idなしでもリクエストは処理される（required: false）', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('X-MCP-Project-Id', testProject.id)
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

      // initializeは処理される
      expect(response.status).toBe(200);
    });
  });

  describe('ハートビート更新', () => {
    beforeEach(() => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: null,
        deletedAt: null,
      });
    });

    it('リクエストごとにハートビートが更新される', async () => {
      const clientId = 'heartbeat-test-client';

      // 古いハートビートでセッションを作成
      const oldHeartbeat = new Date(Date.now() - 30000); // 30秒前
      await createTestAgentSession(testProject.id, {
        clientId,
        status: 'ACTIVE',
        lastHeartbeat: oldHeartbeat,
      });

      // リクエストを送信
      await request(app)
        .post('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('X-MCP-Client-Id', clientId)
        .set('X-MCP-Project-Id', testProject.id)
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'ping',
          id: 1,
        });

      // ハートビートが更新されたことを確認
      const session = await prisma.agentSession.findFirst({
        where: {
          projectId: testProject.id,
          clientId,
          status: 'ACTIVE',
        },
      });

      expect(session?.lastHeartbeat.getTime()).toBeGreaterThan(oldHeartbeat.getTime());
    });
  });

  describe('GET /mcp - SSEエンドポイント', () => {
    it('認証が必要', async () => {
      const response = await request(app).get('/mcp');

      expect(response.status).toBe(401);
    });

    it('認証済みでアクセス可能', async () => {
      setTestAuth({
        id: testUser.id,
        email: testUser.email,
        name: testUser.name,
        avatarUrl: null,
        deletedAt: null,
      });

      // GETリクエストはSSEストリームを開始するため、タイムアウトを短く設定
      const response = await request(app)
        .get('/mcp')
        .set('Cookie', 'access_token=valid-test-token')
        .set('X-MCP-Client-Id', 'sse-test-client')
        .set('X-MCP-Project-Id', testProject.id)
        .timeout(100)
        .catch((err) => err.response);

      // SSE接続開始またはタイムアウト（どちらも正常）
      // 401でないことを確認
      expect(response?.status ?? 200).not.toBe(401);
    });
  });

  describe('DELETE /mcp - セッション終了', () => {
    it('認証が必要', async () => {
      const response = await request(app).delete('/mcp');

      expect(response.status).toBe(401);
    });
  });
});
