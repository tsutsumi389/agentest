import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '@agentest/shared';

// Prismaのモック
const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: mockPrismaUser,
  },
}));

// verifyAccessTokenのモック
const mockVerifyAccessToken = vi.hoisted(() => vi.fn());

vi.mock('@agentest/auth', () => ({
  verifyAccessToken: mockVerifyAccessToken,
  AuthenticationError: class MockAuthError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },
}));

// 環境変数のモック
vi.mock('../../../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret-32-characters-long',
    JWT_REFRESH_SECRET: 'test-refresh-secret-32-characters-long',
    NODE_ENV: 'test',
  },
}));

// モック設定後にインポート
import { mcpAuthenticate } from '../../../middleware/mcp-auth.middleware.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_ACCESS_TOKEN = 'test-access-token';

// Express req, res, next のモック作成
function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    cookies: {},
    user: undefined,
    token: undefined,
    headers: {},
    ...overrides,
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('mcpAuthenticate', () => {
  let mockNext: NextFunction;
  let middleware: ReturnType<typeof mcpAuthenticate>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNext = vi.fn();
    middleware = mcpAuthenticate();
  });

  describe('トークン抽出', () => {
    it('Cookieからaccess_tokenを抽出', async () => {
      const mockPayload = { sub: TEST_USER_ID, email: 'test@example.com' };
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        deletedAt: null,
      });

      const req = createMockRequest({
        cookies: { access_token: TEST_ACCESS_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith(
        TEST_ACCESS_TOKEN,
        expect.objectContaining({
          jwt: expect.objectContaining({
            accessSecret: 'test-access-secret-32-characters-long',
          }),
        })
      );
    });

    it('access_tokenがない場合はAuthenticationErrorをthrow', async () => {
      const req = createMockRequest({
        cookies: {},
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '認証トークンがありません',
        })
      );
    });

    it('cookiesがundefinedの場合もAuthenticationErrorをthrow', async () => {
      const req = createMockRequest();
      delete (req as Record<string, unknown>).cookies;
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '認証トークンがありません',
        })
      );
    });
  });

  describe('JWT検証', () => {
    it('有効なトークンでreq.userとreq.tokenを設定', async () => {
      const mockPayload = { sub: TEST_USER_ID, email: 'test@example.com' };
      const mockUser = {
        id: TEST_USER_ID,
        email: 'test@example.com',
        deletedAt: null,
      };
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockPrismaUser.findUnique.mockResolvedValue(mockUser);

      const req = createMockRequest({
        cookies: { access_token: TEST_ACCESS_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(req.user).toEqual(mockUser);
      expect(req.token).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('無効なトークンでAuthenticationErrorをthrow', async () => {
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('Token verification failed');
      });

      const req = createMockRequest({
        cookies: { access_token: 'invalid-token' },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '無効なトークンです',
        })
      );
    });

    it('AuthenticationErrorがthrowされた場合はそのまま伝播', async () => {
      const authError = new AuthenticationError('Token expired');
      mockVerifyAccessToken.mockImplementation(() => {
        throw authError;
      });

      const req = createMockRequest({
        cookies: { access_token: 'expired-token' },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(authError);
    });
  });

  describe('ユーザー検証', () => {
    it('ユーザーが見つからない場合はAuthenticationErrorをthrow', async () => {
      const mockPayload = { sub: TEST_USER_ID, email: 'test@example.com' };
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockPrismaUser.findUnique.mockResolvedValue(null);

      const req = createMockRequest({
        cookies: { access_token: TEST_ACCESS_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'ユーザーが見つかりません',
        })
      );
    });

    it('削除済みユーザーの場合はAuthenticationErrorをthrow', async () => {
      const mockPayload = { sub: TEST_USER_ID, email: 'test@example.com' };
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        deletedAt: new Date(),
      });

      const req = createMockRequest({
        cookies: { access_token: TEST_ACCESS_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'ユーザーが見つかりません',
        })
      );
    });

    it('ユーザーのIDでfindUniqueを呼び出す', async () => {
      const mockPayload = { sub: TEST_USER_ID, email: 'test@example.com' };
      mockVerifyAccessToken.mockReturnValue(mockPayload);
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        deletedAt: null,
      });

      const req = createMockRequest({
        cookies: { access_token: TEST_ACCESS_TOKEN },
      });
      const res = createMockResponse();

      await middleware(req as Request, res as Response, mockNext);

      expect(mockPrismaUser.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_USER_ID },
      });
    });
  });
});
