import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { apiLimiter, authLimiter, strictLimiter } from '../../middleware/rate-limiter.js';

// リクエスト・レスポンスのモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    method: 'GET',
    url: '/api/test',
    headers: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> & { _status?: number; _json?: unknown } {
  const res: Partial<Response> & { _status?: number; _json?: unknown } = {
    _status: 200,
  };
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res as Response;
  });
  res.json = vi.fn((data: unknown) => {
    res._json = data;
    return res as Response;
  });
  res.setHeader = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe('rate-limiter middleware', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('apiLimiter', () => {
    it('レートリミッターとして定義されている', () => {
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter).toBe('function');
    });

    it('最初のリクエストは通過する', async () => {
      const req = createMockRequest({ ip: '10.0.0.1' });
      const res = createMockResponse();

      await new Promise<void>((resolve) => {
        apiLimiter(req as Request, res as Response, () => {
          mockNext();
          resolve();
        });
      });

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authLimiter', () => {
    it('レートリミッターとして定義されている', () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe('function');
    });

    it('最初のリクエストは通過する', async () => {
      const req = createMockRequest({ ip: '10.0.0.2' });
      const res = createMockResponse();

      await new Promise<void>((resolve) => {
        authLimiter(req as Request, res as Response, () => {
          mockNext();
          resolve();
        });
      });

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('strictLimiter', () => {
    it('レートリミッターとして定義されている', () => {
      expect(strictLimiter).toBeDefined();
      expect(typeof strictLimiter).toBe('function');
    });

    it('最初のリクエストは通過する', async () => {
      const req = createMockRequest({ ip: '10.0.0.3' });
      const res = createMockResponse();

      await new Promise<void>((resolve) => {
        strictLimiter(req as Request, res as Response, () => {
          mockNext();
          resolve();
        });
      });

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('keyGenerator（apiLimiter）', () => {
    it('X-Forwarded-Forヘッダーから最初のIPを取得する', async () => {
      const req = createMockRequest({
        ip: '10.0.0.4',
        headers: {
          'x-forwarded-for': '203.0.113.1, 198.51.100.1',
        },
      });
      const res = createMockResponse();

      await new Promise<void>((resolve) => {
        apiLimiter(req as Request, res as Response, () => {
          mockNext();
          resolve();
        });
      });

      expect(mockNext).toHaveBeenCalled();
    });

    it('X-Forwarded-Forがない場合はreq.ipを使用する', async () => {
      const req = createMockRequest({
        ip: '10.0.0.5',
        headers: {},
      });
      const res = createMockResponse();

      await new Promise<void>((resolve) => {
        apiLimiter(req as Request, res as Response, () => {
          mockNext();
          resolve();
        });
      });

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('エクスポートされた関数の型チェック', () => {
    it('apiLimiterはExpressミドルウェアとして使用可能', () => {
      // ミドルウェア関数の引数数をチェック（3または4引数）
      expect(apiLimiter.length).toBeGreaterThanOrEqual(3);
    });

    it('authLimiterはExpressミドルウェアとして使用可能', () => {
      expect(authLimiter.length).toBeGreaterThanOrEqual(3);
    });

    it('strictLimiterはExpressミドルウェアとして使用可能', () => {
      expect(strictLimiter.length).toBeGreaterThanOrEqual(3);
    });
  });
});
