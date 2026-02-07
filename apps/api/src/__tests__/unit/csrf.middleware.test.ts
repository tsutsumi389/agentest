import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { csrfProtection } from '../../middleware/csrf.middleware.js';

// 環境変数のモック
vi.mock('../../config/env.js', () => ({
  env: {
    FRONTEND_URL: 'http://localhost:5173',
    ADMIN_FRONTEND_URL: 'http://localhost:5174',
    API_BASE_URL: 'http://localhost:3001',
  },
}));

describe('csrfProtection', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      method: 'POST',
      headers: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('GETリクエスト', () => {
    it('GETリクエストはCSRF検証をスキップする', () => {
      mockReq.method = 'GET';

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('HEADリクエストはCSRF検証をスキップする', () => {
      mockReq.method = 'HEAD';

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('OPTIONSリクエストはCSRF検証をスキップする', () => {
      mockReq.method = 'OPTIONS';

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Originヘッダー検証', () => {
    it('許可されたOrigin（フロントエンド）からのリクエストを許可する', () => {
      mockReq.headers = { origin: 'http://localhost:5173' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('許可されたOrigin（管理者フロントエンド）からのリクエストを許可する', () => {
      mockReq.headers = { origin: 'http://localhost:5174' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('許可されたOrigin（API）からのリクエストを許可する', () => {
      mockReq.headers = { origin: 'http://localhost:3001' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('末尾スラッシュ付きのOriginを正しく処理する', () => {
      mockReq.headers = { origin: 'http://localhost:5173/' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('許可されていないOriginからのリクエストを拒否する', () => {
      mockReq.headers = { origin: 'https://evil.com' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'forbidden',
        error_description: 'Invalid request origin',
      });
    });
  });

  describe('Refererヘッダー検証', () => {
    it('Originがない場合、許可されたRefererからのリクエストを許可する', () => {
      mockReq.headers = { referer: 'http://localhost:5173/oauth/consent' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('Originがない場合、管理者フロントエンドのRefererからのリクエストを許可する', () => {
      mockReq.headers = { referer: 'http://localhost:5174/admin/page' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('Refererのパスが違っても同じオリジンなら許可する', () => {
      mockReq.headers = { referer: 'http://localhost:5173/some/deep/path?query=value' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('許可されていないRefererからのリクエストを拒否する', () => {
      mockReq.headers = { referer: 'https://evil.com/page' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'forbidden',
        error_description: 'Invalid request referer',
      });
    });

    it('無効なReferer URLの場合は拒否する', () => {
      mockReq.headers = { referer: 'not-a-valid-url' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });

  describe('ヘッダーなしのリクエスト', () => {
    it('OriginもRefererもない場合は拒否する', () => {
      mockReq.headers = {};

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'forbidden',
        error_description: 'Missing origin or referer header',
      });
    });
  });

  describe('POSTリクエスト以外', () => {
    it('DELETEリクエストもCSRF検証を行う', () => {
      mockReq.method = 'DELETE';
      mockReq.headers = { origin: 'https://evil.com' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('PUTリクエストもCSRF検証を行う', () => {
      mockReq.method = 'PUT';
      mockReq.headers = { origin: 'https://evil.com' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('PATCHリクエストもCSRF検証を行う', () => {
      mockReq.method = 'PATCH';
      mockReq.headers = { origin: 'https://evil.com' };

      csrfProtection()(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
