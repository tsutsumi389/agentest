import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  mcpApiKeyAuthenticate,
  hasApiKeyHeader,
} from '../../../middleware/api-key-auth.middleware.js';
import { SUPPORTED_SCOPES } from '../../../config/scopes.js';

// apiKeyAuthService のモック
const mockValidateToken = vi.fn();
vi.mock('../../../services/api-key-auth.service.js', () => ({
  apiKeyAuthService: {
    validateToken: (...args: unknown[]) => mockValidateToken(...args),
  },
}));

// prisma のモック
const mockFindUnique = vi.fn();
vi.mock('@agentest/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// env のモック
vi.mock('../../../config/env.js', () => ({
  env: {
    MCP_SERVER_URL: 'http://localhost:3001',
    API_INTERNAL_URL: 'http://localhost:3000',
    INTERNAL_API_SECRET: 'test-secret',
  },
}));

describe('api-key-auth.middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;
  let setHeaderMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      headers: {},
    };

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    setHeaderMock = vi.fn();
    mockRes = {
      status: statusMock,
      json: jsonMock,
      setHeader: setHeaderMock,
    };
    mockNext = vi.fn();
  });

  describe('mcpApiKeyAuthenticate', () => {
    it('X-API-Keyヘッダーがない場合は401を返す', async () => {
      const middleware = mcpApiKeyAuthenticate();

      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateToken).not.toHaveBeenCalled();
      expect(setHeaderMock).toHaveBeenCalledWith(
        'WWW-Authenticate',
        expect.stringContaining('Bearer resource_metadata=')
      );
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonrpc: '2.0',
          error: expect.objectContaining({
            code: -32001,
            message: 'Unauthorized',
            data: { reason: 'API key required' },
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('無効なAPIキーの場合は401を返す', async () => {
      mockReq.headers = { 'x-api-key': 'invalid_token' };
      mockValidateToken.mockResolvedValue({ valid: false });

      const middleware = mcpApiKeyAuthenticate();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateToken).toHaveBeenCalledWith('invalid_token');
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            data: { reason: 'Invalid or expired API key' },
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('userIdがない検証結果の場合は401を返す', async () => {
      mockReq.headers = { 'x-api-key': 'agentest_' + 'a'.repeat(43) };
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: null,
        scopes: ['*'],
      });

      const middleware = mcpApiKeyAuthenticate();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('ユーザーが存在しない場合は401を返す', async () => {
      mockReq.headers = { 'x-api-key': 'agentest_' + 'a'.repeat(43) };
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 'user-1',
        scopes: ['*'],
      });
      mockFindUnique.mockResolvedValue(null);

      const middleware = mcpApiKeyAuthenticate();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            data: { reason: 'User not found or deleted' },
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('削除済みユーザーの場合は401を返す', async () => {
      mockReq.headers = { 'x-api-key': 'agentest_' + 'a'.repeat(43) };
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 'user-1',
        scopes: ['*'],
      });
      mockFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        deletedAt: new Date(),
      });

      const middleware = mcpApiKeyAuthenticate();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            data: { reason: 'User not found or deleted' },
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('有効なAPIキーで認証成功', async () => {
      const apiKey = 'agentest_' + 'a'.repeat(43);
      mockReq.headers = { 'x-api-key': apiKey };
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 'user-1',
        scopes: ['mcp:read', 'mcp:write'],
        tokenId: 'token-1',
      });
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        deletedAt: null,
      };
      mockFindUnique.mockResolvedValue(mockUser);

      const middleware = mcpApiKeyAuthenticate();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockValidateToken).toHaveBeenCalledWith(apiKey);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(mockReq.user).toEqual(mockUser);
      expect(mockReq.oauthScopes).toEqual(['mcp:read', 'mcp:write']);
      expect(mockReq.authType).toBe('api-key');
      expect(mockNext).toHaveBeenCalled();
    });

    it('ワイルドカードスコープ(*)がSUPPORTED_SCOPESに展開される', async () => {
      mockReq.headers = { 'x-api-key': 'agentest_' + 'a'.repeat(43) };
      mockValidateToken.mockResolvedValue({
        valid: true,
        userId: 'user-1',
        scopes: ['*'],
      });
      mockFindUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        deletedAt: null,
      });

      const middleware = mcpApiKeyAuthenticate();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.oauthScopes).toEqual([...SUPPORTED_SCOPES]);
      expect(mockNext).toHaveBeenCalled();
    });

    it('検証中にエラーが発生した場合は401を返す', async () => {
      mockReq.headers = { 'x-api-key': 'agentest_' + 'a'.repeat(43) };
      mockValidateToken.mockRejectedValue(new Error('Network error'));

      const middleware = mcpApiKeyAuthenticate();
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            data: { reason: 'Authentication failed' },
          }),
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('hasApiKeyHeader', () => {
    it('X-API-Keyヘッダーがある場合はtrueを返す', () => {
      mockReq.headers = { 'x-api-key': 'some-key' };

      const result = hasApiKeyHeader(mockReq as Request);

      expect(result).toBe(true);
    });

    it('X-API-Keyヘッダーがない場合はfalseを返す', () => {
      mockReq.headers = {};

      const result = hasApiKeyHeader(mockReq as Request);

      expect(result).toBe(false);
    });

    it('空のX-API-Keyヘッダーの場合はfalseを返す', () => {
      mockReq.headers = { 'x-api-key': '' };

      const result = hasApiKeyHeader(mockReq as Request);

      expect(result).toBe(false);
    });
  });
});
