import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// server-instanceのモック
const mockGetServerInstanceId = vi.hoisted(() => vi.fn(() => 'test-instance-id'));
vi.mock('../../lib/server-instance.js', () => ({
  getServerInstanceId: mockGetServerInstanceId,
  getMachineId: vi.fn(() => 'test-machine-id'),
  isInstanceAlive: vi.fn(),
  registerServerInstance: vi.fn(),
  refreshInstanceHeartbeat: vi.fn(),
}));

// streamable-httpのモック（getActiveSessionCountのみ必要）
const mockGetActiveSessionCount = vi.hoisted(() => vi.fn(() => 0));
vi.mock('../../transport/streamable-http.js', () => ({
  createMcpHandler: vi.fn(() => vi.fn()),
  getActiveSessionCount: mockGetActiveSessionCount,
  requestContext: { getStore: vi.fn() },
}));

// MCPサーバーのモック
vi.mock('../../server.js', () => ({
  createMcpServer: vi.fn(() => ({})),
}));

// ミドルウェアのモック
vi.mock('../../middleware/mcp-auth.middleware.js', () => ({
  mcpAuthenticate: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../middleware/oauth-auth.middleware.js', () => ({
  mcpHybridAuthenticate: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../middleware/agent-session.middleware.js', () => ({
  agentSession: vi.fn(() => (_req: any, _res: any, next: any) => next()),
  recordHeartbeat: vi.fn(() => (_req: any, _res: any, next: any) => next()),
}));

vi.mock('../../routes/oauth-metadata.js', () => ({
  default: (_req: any, _res: any, next: any) => next(),
}));

// session-storeのモック
vi.mock('../../lib/session-store.js', () => ({
  saveSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
  refreshSessionTtl: vi.fn(),
}));

import { createApp } from '../../app.js';

describe('GET /health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('インスタンスIDを含むレスポンスを返す', async () => {
    mockGetServerInstanceId.mockReturnValue('test-instance-uuid');
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.instanceId).toBe('test-instance-uuid');
  });

  it('アクティブセッション数を含むレスポンスを返す', async () => {
    mockGetActiveSessionCount.mockReturnValue(5);
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.activeSessions).toBe(5);
  });

  it('完全なヘルスチェックレスポンスを返す', async () => {
    mockGetServerInstanceId.mockReturnValue('instance-123');
    mockGetActiveSessionCount.mockReturnValue(3);
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      service: 'mcp-server',
      instanceId: 'instance-123',
      activeSessions: 3,
    });
  });
});
