import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// loggerのモック
const { mockLogger, mockPinoHttpMiddleware } = vi.hoisted(() => {
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

  const mockPinoHttpMiddleware = vi.fn(
    (_req: unknown, _res: unknown, next: () => void) => { next(); }
  );

  return { mockLogger, mockPinoHttpMiddleware };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// pino-httpのモック（実際のpino-httpはloggerを受け取ってミドルウェアを返す）
vi.mock('pino-http', () => ({
  pinoHttp: vi.fn(() => mockPinoHttpMiddleware),
}));

// crypto.randomUUIDのモック
const mockUUID = '12345678-1234-1234-1234-123456789abc';
vi.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID);

// モック設定後にインポート
import { httpLogger, attachRequestId } from '../../middleware/request-logger.js';

describe('request-logger middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      method: 'GET',
      originalUrl: '/api/users',
      headers: {},
      get: vi.fn().mockImplementation((header: string) => {
        if (header === 'user-agent') return 'Mozilla/5.0';
        return undefined;
      }) as Request['get'],
      ip: '192.168.1.1',
    };

    mockRes = {
      statusCode: 200,
      setHeader: vi.fn(),
    };

    mockNext = vi.fn();
  });

  describe('httpLogger', () => {
    it('pino-httpミドルウェアとしてエクスポートされている', () => {
      expect(httpLogger).toBeDefined();
    });
  });

  describe('attachRequestId', () => {
    it('リクエストにrequestIdを付与する', () => {
      attachRequestId(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBeDefined();
    });

    it('X-Request-IDヘッダーを設定する', () => {
      attachRequestId(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    });

    it('nextを呼び出す', () => {
      attachRequestId(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('req.idが存在する場合はそれを使用する', () => {
      const existingId = 'existing-request-id';
      (mockReq as Request & { id: string }).id = existingId;

      attachRequestId(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBe(existingId);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
    });

    it('req.idが存在しない場合はcrypto.randomUUIDを使用する', () => {
      attachRequestId(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBe(mockUUID);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Request-ID', mockUUID);
    });
  });
});
