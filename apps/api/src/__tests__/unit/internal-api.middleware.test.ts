import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// envのモック
const mockEnv = vi.hoisted(() => ({
  INTERNAL_API_SECRET: 'test-internal-api-secret-32characters',
}));

vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

// モック設定後にインポート
import { requireInternalApiAuth } from '../../middleware/internal-api.middleware.js';

// Express req, res, next のモック作成
function createMockRequest(headers: Record<string, string | undefined> = {}): Partial<Request> {
  return {
    headers,
  };
}

function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('requireInternalApiAuth', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('正しいシークレットの場合', () => {
    it('nextが呼ばれる', () => {
      const req = createMockRequest({
        'x-internal-api-key': 'test-internal-api-secret-32characters',
      });
      const res = createMockResponse();

      const middleware = requireInternalApiAuth();
      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('不正なシークレットの場合', () => {
    it('403 Forbiddenを返す', () => {
      const req = createMockRequest({
        'x-internal-api-key': 'wrong-secret',
      });
      const res = createMockResponse();

      const middleware = requireInternalApiAuth();
      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid or missing internal API key',
      });
    });
  });

  describe('ヘッダーが未設定の場合', () => {
    it('403 Forbiddenを返す', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      const middleware = requireInternalApiAuth();
      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Invalid or missing internal API key',
      });
    });

    it('ヘッダーがundefinedの場合も403を返す', () => {
      const req = createMockRequest({
        'x-internal-api-key': undefined,
      });
      const res = createMockResponse();

      const middleware = requireInternalApiAuth();
      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('空文字のシークレットの場合', () => {
    it('403 Forbiddenを返す', () => {
      const req = createMockRequest({
        'x-internal-api-key': '',
      });
      const res = createMockResponse();

      const middleware = requireInternalApiAuth();
      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
});
