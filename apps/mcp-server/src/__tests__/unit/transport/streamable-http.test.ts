import { describe, it, expect, vi, beforeEach } from 'vitest';

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

vi.mock('../../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// session-storeのモック
const mockSessionStore = vi.hoisted(() => ({
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock('../../../lib/session-store.js', () => mockSessionStore);

// server-instanceのモック
const mockServerInstance = vi.hoisted(() => ({
  getMachineId: vi.fn(() => 'current-machine-id'),
  isInstanceAlive: vi.fn(),
}));

vi.mock('../../../lib/server-instance.js', () => mockServerInstance);

import { resolveSessionError } from '../../../transport/streamable-http.js';

describe('resolveSessionError', () => {
  let mockRes: {
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  it('セッションIDなしの場合はsession_not_foundを返す', async () => {
    await resolveSessionError(
      undefined,
      { jsonrpc: '2.0', method: 'test', id: 1 },
      mockRes as any
    );

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        jsonrpc: '2.0',
        error: expect.objectContaining({
          code: -32600,
          data: expect.objectContaining({
            reason: 'session_not_found',
            reinitialize: true,
          }),
        }),
        id: 1,
      })
    );
  });

  it('Redisにも存在しないセッションはsession_not_foundを返す', async () => {
    mockSessionStore.getSession.mockResolvedValue(null);

    await resolveSessionError(
      'unknown-session',
      { jsonrpc: '2.0', method: 'test', id: 2 },
      mockRes as any
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          data: expect.objectContaining({
            reason: 'session_not_found',
            reinitialize: true,
          }),
        }),
        id: 2,
      })
    );
  });

  it('同じマシンIDの場合はserver_restartedを返す', async () => {
    mockSessionStore.getSession.mockResolvedValue({
      userId: 'user-1',
      instanceId: 'old-instance',
      machineId: 'current-machine-id', // 同じマシンID
      createdAt: '2026-02-24T12:00:00.000Z',
    });

    await resolveSessionError(
      'restarted-session',
      { jsonrpc: '2.0', method: 'test', id: 3 },
      mockRes as any
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          data: expect.objectContaining({
            reason: 'server_restarted',
            reinitialize: true,
          }),
        }),
        id: 3,
      })
    );
    // 使えないセッションをRedisから削除
    expect(mockSessionStore.deleteSession).toHaveBeenCalledWith('restarted-session');
  });

  it('別マシンで生存中のインスタンスの場合はwrong_instanceを返す', async () => {
    mockSessionStore.getSession.mockResolvedValue({
      userId: 'user-1',
      instanceId: 'other-instance',
      machineId: 'other-machine-id', // 別のマシンID
      createdAt: '2026-02-24T12:00:00.000Z',
    });
    mockServerInstance.isInstanceAlive.mockResolvedValue(true);

    await resolveSessionError(
      'wrong-instance-session',
      { jsonrpc: '2.0', method: 'test', id: 4 },
      mockRes as any
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          data: expect.objectContaining({
            reason: 'wrong_instance',
            reinitialize: true,
          }),
        }),
        id: 4,
      })
    );
    expect(mockServerInstance.isInstanceAlive).toHaveBeenCalledWith('other-instance');
    expect(mockSessionStore.deleteSession).toHaveBeenCalledWith('wrong-instance-session');
  });

  it('別マシンでインスタンスが停止している場合はinstance_terminatedを返す', async () => {
    mockSessionStore.getSession.mockResolvedValue({
      userId: 'user-1',
      instanceId: 'dead-instance',
      machineId: 'dead-machine-id', // 別のマシンID
      createdAt: '2026-02-24T12:00:00.000Z',
    });
    mockServerInstance.isInstanceAlive.mockResolvedValue(false);

    await resolveSessionError(
      'terminated-session',
      { jsonrpc: '2.0', method: 'test', id: 5 },
      mockRes as any
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          data: expect.objectContaining({
            reason: 'instance_terminated',
            reinitialize: true,
          }),
        }),
        id: 5,
      })
    );
    expect(mockSessionStore.deleteSession).toHaveBeenCalledWith('terminated-session');
  });

  it('bodyがnullの場合もid: nullで返す', async () => {
    await resolveSessionError(
      undefined,
      null as any,
      mockRes as any
    );

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: null,
      })
    );
  });
});
