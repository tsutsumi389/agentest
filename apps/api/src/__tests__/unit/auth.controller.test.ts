import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '@agentest/shared';

// vi.hoisted でホイスティング問題を回避
const mockSessionService = vi.hoisted(() => ({
  createSession: vi.fn(),
}));

const mockGenerateTokens = vi.hoisted(() => vi.fn());
const mockVerifyRefreshToken = vi.hoisted(() => vi.fn());

const mockPrismaRefreshToken = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
}));

const mockPrismaSession = vi.hoisted(() => ({
  updateMany: vi.fn(),
}));

const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

const mockPrismaAccount = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../services/session.service.js', () => ({
  SessionService: vi.fn().mockImplementation(() => mockSessionService),
}));

vi.mock('@agentest/auth', () => ({
  generateTokens: (...args: unknown[]) => mockGenerateTokens(...args),
  verifyRefreshToken: (...args: unknown[]) => mockVerifyRefreshToken(...args),
}));

const mockPrismaTransaction = vi.hoisted(() => vi.fn());

vi.mock('@agentest/db', () => {
  const prismaInstance = {
    refreshToken: mockPrismaRefreshToken,
    session: { ...mockPrismaSession, create: vi.fn() },
    user: mockPrismaUser,
    account: mockPrismaAccount,
    $transaction: mockPrismaTransaction,
  };
  // $transaction はコールバックに prisma 自身を渡す
  mockPrismaTransaction.mockImplementation(async (fn: (tx: typeof prismaInstance) => Promise<unknown>) => fn(prismaInstance));
  return { prisma: prismaInstance };
});

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    NODE_ENV: 'test',
    CORS_ORIGIN: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3000',
  },
}));

vi.mock('../../middleware/session.middleware.js', () => ({
  extractClientInfo: vi.fn().mockReturnValue({
    userAgent: 'test-agent',
    ipAddress: '127.0.0.1',
  }),
}));

// コントローラのインポートはモック後に行う
import { AuthController } from '../../controllers/auth.controller.js';
import { hashToken } from '../../utils/pkce.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_REFRESH_TOKEN = 'test-refresh-token';
const NEW_REFRESH_TOKEN = 'new-refresh-token';
const NEW_ACCESS_TOKEN = 'new-access-token';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: {
    id: TEST_USER_ID,
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
    plan: 'FREE',
    createdAt: new Date(),
  } as any,
  params: {},
  body: {},
  cookies: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  return res;
};

describe('AuthController', () => {
  let controller: AuthController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController();
    mockNext = vi.fn();
  });

  describe('me', () => {
    it('現在のユーザー情報を取得できる', async () => {
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.me(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: TEST_USER_ID,
          email: 'test@example.com',
          name: 'Test User',
        }),
      });
    });

    it('req.userがない場合AuthenticationError', async () => {
      const req = mockRequest({ user: undefined }) as Request;
      const res = mockResponse() as Response;

      await controller.me(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('refresh', () => {
    it('クッキーのリフレッシュトークンでトークンを更新できる', async () => {
      mockVerifyRefreshToken.mockReturnValue({ sub: TEST_USER_ID });
      // 楽観的ロックでアトミックに無効化
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        deletedAt: null,
      });
      mockGenerateTokens.mockReturnValue({
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
      });
      mockPrismaRefreshToken.create.mockResolvedValue({});
      mockSessionService.createSession.mockResolvedValue({});

      const req = mockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.refresh(req, res, mockNext);

      // 楽観的ロックでトークンをアトミックに無効化
      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          tokenHash: hashToken(TEST_REFRESH_TOKEN),
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockPrismaTransaction).toHaveBeenCalled();
      expect(res.cookie).toHaveBeenCalledWith('access_token', NEW_ACCESS_TOKEN, expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', NEW_REFRESH_TOKEN, expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        message: 'トークンが更新されました',
      });
    });

    it('ボディのリフレッシュトークンでも更新できる', async () => {
      mockVerifyRefreshToken.mockReturnValue({ sub: TEST_USER_ID });
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaSession.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        deletedAt: null,
      });
      mockGenerateTokens.mockReturnValue({
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
      });
      mockPrismaRefreshToken.create.mockResolvedValue({});

      const req = mockRequest({
        body: { refreshToken: TEST_REFRESH_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.refresh(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        message: 'トークンが更新されました',
      });
    });

    it('リフレッシュトークンがない場合AuthenticationError', async () => {
      const req = mockRequest({
        cookies: {},
        body: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.refresh(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('無効なトークン（既に無効化済みまたは期限切れ）の場合AuthenticationError', async () => {
      mockVerifyRefreshToken.mockReturnValue({ sub: TEST_USER_ID });
      // ユーザー取得はトランザクションの前に実行される
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        email: 'test@example.com',
        deletedAt: null,
      });
      mockGenerateTokens.mockReturnValue({
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
      });
      // 楽観的ロック: 更新件数0 = 既に無効化済み or 期限切れ or 存在しない
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 0 });

      const req = mockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.refresh(req, res, mockNext);

      expect(mockPrismaTransaction).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('削除済みユーザーの場合AuthenticationError', async () => {
      mockVerifyRefreshToken.mockReturnValue({ sub: TEST_USER_ID });
      // ユーザー取得はトランザクションの前に実行されるため、ここでエラーになる
      mockPrismaUser.findUnique.mockResolvedValue({
        id: TEST_USER_ID,
        deletedAt: new Date(),
      });

      const req = mockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.refresh(req, res, mockNext);

      // トランザクションに到達する前にエラーがスローされる
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('logout', () => {
    it('ログアウトしてトークンを無効化できる', async () => {
      mockPrismaRefreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrismaSession.updateMany.mockResolvedValue({ count: 1 });

      const req = mockRequest({
        cookies: { refresh_token: TEST_REFRESH_TOKEN },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.logout(req, res, mockNext);

      expect(mockPrismaRefreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashToken(TEST_REFRESH_TOKEN) },
        data: { revokedAt: expect.any(Date) },
      });
      expect(mockPrismaSession.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashToken(TEST_REFRESH_TOKEN) },
        data: { revokedAt: expect.any(Date) },
      });
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
      expect(res.json).toHaveBeenCalledWith({ message: 'ログアウトしました' });
    });

    it('リフレッシュトークンがなくてもログアウトできる', async () => {
      const req = mockRequest({
        cookies: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.logout(req, res, mockNext);

      expect(mockPrismaRefreshToken.updateMany).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('access_token', { path: '/' });
      expect(res.clearCookie).toHaveBeenCalledWith('refresh_token', { path: '/' });
      expect(res.json).toHaveBeenCalledWith({ message: 'ログアウトしました' });
    });
  });

  describe('oauthCallback', () => {
    it('OAuth認証成功時にトークンを設定してリダイレクト', async () => {
      mockGenerateTokens.mockReturnValue({
        accessToken: NEW_ACCESS_TOKEN,
        refreshToken: NEW_REFRESH_TOKEN,
      });
      mockPrismaRefreshToken.create.mockResolvedValue({});
      mockSessionService.createSession.mockResolvedValue({});

      const req = mockRequest({
        user: {
          userId: TEST_USER_ID,
          email: 'test@example.com',
        },
        cookies: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.oauthCallback(req, res, mockNext);

      expect(res.cookie).toHaveBeenCalledWith('access_token', NEW_ACCESS_TOKEN, expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('refresh_token', NEW_REFRESH_TOKEN, expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/auth/callback');
    });

    it('req.userがない場合AuthenticationError', async () => {
      const req = mockRequest({
        user: undefined,
        cookies: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.oauthCallback(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('連携追加モードで正常に連携できる', async () => {
      mockPrismaAccount.findUnique.mockResolvedValue(null);
      mockPrismaAccount.create.mockResolvedValue({});

      const linkMode = { provider: 'github', userId: TEST_USER_ID };
      const req = mockRequest({
        user: {
          userId: TEST_USER_ID,
          email: 'test@example.com',
          profile: {
            provider: 'github',
            providerAccountId: 'github-123',
          },
        },
        cookies: {
          oauth_link_mode: JSON.stringify(linkMode),
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.oauthCallback(req, res, mockNext);

      expect(res.clearCookie).toHaveBeenCalledWith('oauth_link_mode', { path: '/' });
      expect(mockPrismaAccount.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: TEST_USER_ID,
          provider: 'github',
          providerAccountId: 'github-123',
        }),
      });
      expect(res.redirect).toHaveBeenCalledWith('http://localhost:3000/settings?tab=security&link=success');
    });

    it('既に連携済みの場合エラーリダイレクト', async () => {
      // 同じアカウントが同じユーザーに紐づいている場合
      mockPrismaAccount.findUnique.mockResolvedValue({
        userId: TEST_USER_ID,
      });

      const linkMode = { provider: 'github', userId: TEST_USER_ID };
      const req = mockRequest({
        user: {
          userId: TEST_USER_ID,
          email: 'test@example.com',
          profile: {
            provider: 'github',
            providerAccountId: 'github-123',
          },
        },
        cookies: {
          oauth_link_mode: JSON.stringify(linkMode),
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.oauthCallback(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('link=error'));
    });

    it('他ユーザーに連携済みの場合エラーリダイレクト', async () => {
      // 同じアカウントが別のユーザーに紐づいている場合
      mockPrismaAccount.findUnique.mockResolvedValue({
        userId: 'other-user-id',
      });

      const linkMode = { provider: 'github', userId: TEST_USER_ID };
      const req = mockRequest({
        user: {
          userId: TEST_USER_ID,
          email: 'test@example.com',
          profile: {
            provider: 'github',
            providerAccountId: 'github-123',
          },
        },
        cookies: {
          oauth_link_mode: JSON.stringify(linkMode),
        },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.oauthCallback(req, res, mockNext);

      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('link=error'));
    });
  });
});
