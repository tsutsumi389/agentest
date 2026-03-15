import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { rateLimiter } from '../../middleware/rate-limiter.js';

// Redis モック
const mockPipeline = {
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

const mockRedisClient = {
  pipeline: vi.fn(() => mockPipeline),
};

vi.mock('../../lib/redis-store.js', () => ({
  getRedisClient: vi.fn(() => mockRedisClient),
}));

// Logger モック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }));

/** テスト用の共通オプション */
const defaultOptions = { max: 5, windowMs: 60000, routeId: '2fa-test' };

/**
 * テスト用のリクエスト・レスポンスオブジェクトを生成
 */
function createMockReqRes(overrides: Partial<Request> = {}) {
  const req = {
    ip: '127.0.0.1',
    path: '/2fa/setup',
    socket: { remoteAddress: '127.0.0.1' },
    user: undefined,
    ...overrides,
  } as unknown as Request;

  const headers: Record<string, string> = {};
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    set: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    _headers: headers,
  } as unknown as Response & { _headers: Record<string, string> };

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('rateLimiter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // デフォルト: リクエスト数 = 1（制限内）
    mockPipeline.exec.mockResolvedValue([
      [null, 0], // zremrangebyscore
      [null, 1], // zadd
      [null, 1], // zcard - リクエスト数
      [null, 1], // pexpire
    ]);
  });

  it('制限内のリクエストを許可する', async () => {
    const middleware = rateLimiter(defaultOptions);
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
    expect(res.set).toHaveBeenCalledWith('X-RateLimit-Remaining', '4');
  });

  it('制限超過時に429とRetry-Afterヘッダーを返す', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 6], // 6リクエスト > max 5
      [null, 1],
    ]);

    const middleware = rateLimiter(defaultOptions);
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.set).toHaveBeenCalledWith('Retry-After', '60');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
        }),
      })
    );
  });

  it('routeIdをRedisキーに使用する（req.pathではなく）', async () => {
    const middleware = rateLimiter({ max: 5, windowMs: 60000, routeId: '2fa-setup' });
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    // RedisキーにrouteIdが含まれることを確認
    const zaddCall = mockPipeline.zadd.mock.calls[0];
    expect(zaddCall[0]).toContain('2fa-setup');
    expect(zaddCall[0]).not.toContain('/2fa/setup');
  });

  it('認証済みユーザーはuserIdをキーに使用する', async () => {
    const middleware = rateLimiter(defaultOptions);
    const { req, res, next } = createMockReqRes({
      user: { id: 'user-123', email: 'test@example.com' } as Request['user'],
    });

    await middleware(req, res, next);

    const zaddCall = mockPipeline.zadd.mock.calls[0];
    expect(zaddCall[0]).toContain('user:user-123');
  });

  it('未認証ユーザーはIPアドレスをキーに使用する', async () => {
    const middleware = rateLimiter(defaultOptions);
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    const zaddCall = mockPipeline.zadd.mock.calls[0];
    expect(zaddCall[0]).toContain('ip:127.0.0.1');
  });

  it('カスタムメッセージを設定できる', async () => {
    mockPipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 6],
      [null, 1],
    ]);

    const customMessage = 'カスタムエラーメッセージ';
    const middleware = rateLimiter({ ...defaultOptions, message: customMessage });
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: customMessage }),
      })
    );
  });

  it('Redis未設定時はリクエストを許可する', async () => {
    const { getRedisClient } = await import('../../lib/redis-store.js');
    (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const middleware = rateLimiter(defaultOptions);
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockPipeline.exec).not.toHaveBeenCalled();
  });

  it('Redisエラー時はリクエストを許可する（可用性優先）', async () => {
    mockPipeline.exec.mockRejectedValue(new Error('Redis connection error'));

    const middleware = rateLimiter(defaultOptions);
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('パイプライン結果が不正な場合はエラーとして処理する', async () => {
    mockPipeline.exec.mockResolvedValue(null);

    const middleware = rateLimiter(defaultOptions);
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    // エラーとして処理され、リクエストは許可される
    expect(next).toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('Sliding Windowアルゴリズムが正しく実行される', async () => {
    const middleware = rateLimiter({ max: 3, windowMs: 60000, routeId: '2fa-test' });
    const { req, res, next } = createMockReqRes();

    await middleware(req, res, next);

    // パイプラインコマンドの確認
    expect(mockPipeline.zremrangebyscore).toHaveBeenCalledWith(
      expect.any(String),
      0,
      expect.any(Number) // windowStart
    );
    expect(mockPipeline.zadd).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Number), // timestamp
      expect.any(String) // unique member
    );
    expect(mockPipeline.zcard).toHaveBeenCalledWith(expect.any(String));
    expect(mockPipeline.pexpire).toHaveBeenCalledWith(expect.any(String), 60000);
  });
});
