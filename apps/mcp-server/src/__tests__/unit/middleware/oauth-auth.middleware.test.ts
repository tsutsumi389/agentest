import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Prismaのモック
const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

// tokenIntrospectionServiceのモック
const mockValidateToken = vi.hoisted(() => vi.fn());

vi.mock('../../../services/token-introspection.service.js', () => ({
  tokenIntrospectionService: {
    validateToken: mockValidateToken,
  },
}));

// 環境変数のモック
vi.mock('../../../config/env.js', () => ({
  env: {
    MCP_SERVER_URL: 'http://localhost:3002',
    API_URL: 'http://localhost:3001',
    INTERNAL_API_SECRET: 'test-internal-secret',
    NODE_ENV: 'test',
  },
}));

// モック設定後にインポート
import {
  mcpOAuthAuthenticate,
  mcpHybridAuthenticate,
  requireScope,
} from '../../../middleware/oauth-auth.middleware.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ACCESS_TOKEN = 'test-oauth-access-token';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    cookies: {},
    user: undefined,
    oauthScopes: undefined,
    headers: {},
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  const res: Partial<Response> = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('mcpOAuthAuthenticate', () => {
  let mockNext: NextFunction;
  let middleware: ReturnType<typeof mcpOAuthAuthenticate>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    middleware = mcpOAuthAuthenticate();
  });

  describe('Bearer Token認証', () => {
    it('有効なBearer Tokenで認証成功', async () => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: TEST_USER_ID,
        scopes: ['mcp:read', 'mcp:write'],
      });
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
      });

      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockValidateToken).toHaveBeenCalledWith(
        TEST_ACCESS_TOKEN,
        'http://localhost:3002'
      );
      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
      });
      expect(req.user).toEqual({
        id: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
      });
      expect(req.oauthScopes).toEqual(['mcp:read', 'mcp:write']);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('Authorizationヘッダーがない場合は401エラー', async () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        expect.stringContaining('Bearer')
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: -32001,
            message: 'Unauthorized',
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('Bearer以外の認証スキームは401エラー', async () => {
      const req = createMockRequest({
        headers: {
          authorization: 'Basic dXNlcjpwYXNz',
        },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('無効なトークンは401エラー', async () => {
      mockValidateToken.mockResolvedValue({
        valid: false,
      });

      const req = createMockRequest({
        headers: {
          authorization: `Bearer invalid-token`,
        },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            data: expect.objectContaining({
              reason: 'Invalid or expired token',
            }),
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('ユーザーが見つからない場合は401エラー', async () => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: TEST_USER_ID,
        scopes: ['mcp:read'],
      });
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            data: expect.objectContaining({
              reason: 'User not found',
            }),
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('トークン検証でエラーが発生した場合は401エラー', async () => {
      mockValidateToken.mockRejectedValue(new Error('Network error'));

      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('WWW-Authenticateヘッダーにメタデータパスを含む', async () => {
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(res.setHeader).toHaveBeenCalledWith(
        'WWW-Authenticate',
        expect.stringContaining('/.well-known/oauth-protected-resource')
      );
    });
  });
});

describe('mcpHybridAuthenticate', () => {
  let mockNext: NextFunction;
  let mockFallbackAuth: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    mockFallbackAuth = vi.fn((_req: Request, _res: Response, next: NextFunction) => next());
  });

  describe('認証方式の選択', () => {
    it('Bearer Tokenがある場合はOAuth認証を使用', async () => {
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: TEST_USER_ID,
        scopes: ['mcp:read'],
      });
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        name: 'Test User',
      });

      const middleware = mcpHybridAuthenticate(mockFallbackAuth);
      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${TEST_ACCESS_TOKEN}`,
        },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockValidateToken).toHaveBeenCalled();
      expect(mockFallbackAuth).not.toHaveBeenCalled();
    });

    it('Bearer Tokenがない場合はフォールバック認証を使用', async () => {
      const middleware = mcpHybridAuthenticate(mockFallbackAuth);
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockValidateToken).not.toHaveBeenCalled();
      expect(mockFallbackAuth).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('フォールバックがない場合は401エラー', async () => {
      const middleware = mcpHybridAuthenticate();
      const req = createMockRequest({
        headers: {},
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('requireScope', () => {
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
  });

  describe('スコープ検証', () => {
    it('必要なスコープがすべてある場合は通過', () => {
      const middleware = requireScope('mcp:read', 'mcp:write');
      const req = createMockRequest({
        oauthScopes: ['mcp:read', 'mcp:write', 'project:read'],
      });
      const res = createMockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('スコープが不足している場合は403エラー', () => {
      const middleware = requireScope('mcp:read', 'mcp:write');
      const req = createMockRequest({
        oauthScopes: ['mcp:read'], // mcp:writeが不足
      });
      const res = createMockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: -32003,
            message: 'Forbidden',
            data: expect.objectContaining({
              reason: 'Insufficient scope',
              required: ['mcp:read', 'mcp:write'],
              granted: ['mcp:read'],
            }),
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('スコープが空の場合は403エラー', () => {
      const middleware = requireScope('mcp:read');
      const req = createMockRequest({
        oauthScopes: [],
      });
      const res = createMockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('oauthScopesがundefinedの場合は403エラー', () => {
      const middleware = requireScope('mcp:read');
      const req = createMockRequest({
        oauthScopes: undefined,
      });
      const res = createMockResponse();

      middleware(req as Request, res as Response, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
