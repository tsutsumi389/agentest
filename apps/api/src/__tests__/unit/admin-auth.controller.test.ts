import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '@agentest/shared';

// AdminAuthService のモック（vi.hoistedを使用）
const mockAuthService = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../../services/admin/admin-auth.service.js', () => ({
  AdminAuthService: vi.fn().mockImplementation(() => mockAuthService),
}));

// AdminSessionService のモック（vi.hoistedを使用）
const mockSessionService = vi.hoisted(() => ({
  generateToken: vi.fn(),
  createSession: vi.fn(),
  validateSession: vi.fn(),
  refreshSession: vi.fn(),
  revokeSession: vi.fn(),
  updateActivity: vi.fn(),
}));

vi.mock('../../services/admin/admin-session.service.js', () => ({
  AdminSessionService: vi.fn().mockImplementation(() => mockSessionService),
}));

// extractClientInfo のモック
vi.mock('../../middleware/session.middleware.js', () => ({
  extractClientInfo: vi.fn().mockReturnValue({
    ipAddress: '127.0.0.1',
    userAgent: 'Test Browser',
  }),
}));

// env のモック
vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
  },
}));

// コントローラーのインポートはモック設定後
import {
  AdminAuthController,
  requireAdminAuth,
} from '../../controllers/admin/auth.controller.js';

// モックリクエスト・レスポンス・ネクスト
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    body: {},
    adminUser: undefined,
    adminSession: undefined,
    ...overrides,
  } as Request;
}

function createMockRes(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('requireAdminAuth ミドルウェア', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('クッキーからトークンを取得して認証できる', async () => {
    const mockSession = {
      id: 'session-1',
      token: 'valid-token',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      adminUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
        totpEnabled: false,
      },
    };
    mockSessionService.validateSession.mockResolvedValue(mockSession);
    mockSessionService.updateActivity.mockResolvedValue(undefined);

    const req = createMockReq({
      cookies: { admin_session: 'valid-token' },
    });
    const res = createMockRes();
    const next = createMockNext();

    const middleware = requireAdminAuth();
    await middleware(req, res, next);

    expect(mockSessionService.validateSession).toHaveBeenCalledWith('valid-token');
    expect(next).toHaveBeenCalledWith();
  });

  it('req.adminUser, req.adminSessionを設定する', async () => {
    const mockSession = {
      id: 'session-1',
      token: 'valid-token',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      adminUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
        totpEnabled: false,
      },
    };
    mockSessionService.validateSession.mockResolvedValue(mockSession);
    mockSessionService.updateActivity.mockResolvedValue(undefined);

    const req = createMockReq({
      cookies: { admin_session: 'valid-token' },
    });
    const res = createMockRes();
    const next = createMockNext();

    const middleware = requireAdminAuth();
    await middleware(req, res, next);

    expect(req.adminUser).toEqual(mockSession.adminUser);
    expect(req.adminSession).toEqual({
      id: mockSession.id,
      token: mockSession.token,
      createdAt: mockSession.createdAt,
      expiresAt: mockSession.expiresAt,
    });
  });

  it('クッキーがない場合はAuthenticationError', async () => {
    const req = createMockReq({
      cookies: {},
    });
    const res = createMockRes();
    const next = createMockNext();

    const middleware = requireAdminAuth();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error.message).toBe('認証が必要です');
  });

  it('無効なセッションの場合はAuthenticationError', async () => {
    mockSessionService.validateSession.mockResolvedValue(null);

    const req = createMockReq({
      cookies: { admin_session: 'invalid-token' },
    });
    const res = createMockRes();
    const next = createMockNext();

    const middleware = requireAdminAuth();
    await middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error.message).toBe('セッションが無効または期限切れです');
  });
});

describe('AdminAuthController', () => {
  let controller: AdminAuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminAuthController();
  });

  describe('login', () => {
    it('ログイン成功時にクッキーを設定する', async () => {
      const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      mockAuthService.login.mockResolvedValue({
        admin: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
        session: {
          token: 'session-token',
          expiresAt,
        },
      });

      const req = createMockReq({
        body: {
          email: 'admin@example.com',
          password: 'correct-password',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'admin_session',
        'session-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/admin',
          expires: expiresAt,
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        admin: expect.objectContaining({
          id: 'admin-1',
          email: 'admin@example.com',
        }),
        expiresAt: expiresAt.toISOString(),
      });
    });

    it('バリデーションエラー: メール形式不正', async () => {
      const req = createMockReq({
        body: {
          email: 'invalid-email',
          password: 'password',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('バリデーションエラー: パスワード空', async () => {
      const req = createMockReq({
        body: {
          email: 'admin@example.com',
          password: '',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('認証エラーをnextに渡す', async () => {
      const authError = new AuthenticationError('認証に失敗しました');
      mockAuthService.login.mockRejectedValue(authError);

      const req = createMockReq({
        body: {
          email: 'admin@example.com',
          password: 'wrong-password',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(authError);
    });
  });

  describe('logout', () => {
    it('ログアウト成功時にクッキーをクリアする', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
        adminSession: {
          id: 'session-1',
          token: 'session-token',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.logout(req, res, next);

      expect(res.clearCookie).toHaveBeenCalledWith(
        'admin_session',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/admin',
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'ログアウトしました',
      });
    });

    it('未認証の場合はAuthenticationError', async () => {
      const req = createMockReq({
        adminUser: undefined,
        adminSession: undefined,
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.logout(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('me', () => {
    it('現在の管理者情報を取得できる', async () => {
      const adminUser = {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Test Admin',
        role: 'ADMIN',
        totpEnabled: false,
      };

      const req = createMockReq({
        adminUser,
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.me(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        admin: adminUser,
      });
    });

    it('未認証の場合はAuthenticationError', async () => {
      const req = createMockReq({
        adminUser: undefined,
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.me(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('refresh', () => {
    it('セッション延長成功時にクッキーを更新する', async () => {
      const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      mockAuthService.refreshSession.mockResolvedValue(newExpiresAt);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
        adminSession: {
          id: 'session-1',
          token: 'session-token',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.refresh(req, res, next);

      expect(res.cookie).toHaveBeenCalledWith(
        'admin_session',
        'session-token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/admin',
          expires: newExpiresAt,
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        expiresAt: newExpiresAt.toISOString(),
      });
    });

    it('延長失敗時はAuthenticationError', async () => {
      mockAuthService.refreshSession.mockResolvedValue(null);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
        adminSession: {
          id: 'session-1',
          token: 'session-token',
          createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000), // 9時間前
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.refresh(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toContain('再度ログイン');
    });

    it('未認証の場合はAuthenticationError', async () => {
      const req = createMockReq({
        adminUser: undefined,
        adminSession: undefined,
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.refresh(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });
});
