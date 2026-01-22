import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AdminRoleType } from '@agentest/db';
import { AuthenticationError, AuthorizationError } from '@agentest/shared';

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

// ミドルウェアのインポートはモック設定後
import {
  requireAdminRole,
  requireAdminAuth,
} from '../../middleware/require-admin-role.js';

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

describe('requireAdminRole ミドルウェア', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ロールチェック', () => {
    it('指定されたロールを持つ管理者は許可される', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: AdminRoleType.ADMIN,
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

      const middleware = requireAdminRole([AdminRoleType.ADMIN]);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('SUPER_ADMINは全てのロールで許可される', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        adminUser: {
          id: 'admin-1',
          email: 'superadmin@example.com',
          name: 'Super Admin',
          role: AdminRoleType.SUPER_ADMIN,
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

      // ADMIN権限を要求しても、SUPER_ADMINは通過できる
      const middleware = requireAdminRole([AdminRoleType.ADMIN]);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('ロール不足の場合はAuthorizationError', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        adminUser: {
          id: 'admin-1',
          email: 'viewer@example.com',
          name: 'Viewer',
          role: AdminRoleType.VIEWER,
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

      // ADMIN権限を要求するが、VIEWERしか持っていない
      const middleware = requireAdminRole([AdminRoleType.ADMIN]);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
      const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(error.message).toBe('この操作を行う権限がありません');
    });

    it('空のロール配列の場合は認証のみチェック', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        adminUser: {
          id: 'admin-1',
          email: 'viewer@example.com',
          name: 'Viewer',
          role: AdminRoleType.VIEWER,
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

      // 空のロール配列
      const middleware = requireAdminRole([]);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('複数ロール指定時、いずれかを持っていれば許可', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Admin',
          role: AdminRoleType.ADMIN,
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

      // SUPER_ADMINまたはADMINを要求
      const middleware = requireAdminRole([AdminRoleType.SUPER_ADMIN, AdminRoleType.ADMIN]);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('認証チェック', () => {
    it('クッキーがない場合は401エラー', async () => {
      const req = createMockReq({
        cookies: {},
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAdminRole([AdminRoleType.ADMIN]);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('無効なセッションの場合は401エラー', async () => {
      mockSessionService.validateSession.mockResolvedValue(null);

      const req = createMockReq({
        cookies: { admin_session: 'invalid-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAdminRole([AdminRoleType.ADMIN]);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('最終活動時刻の更新', () => {
    it('セッションの最終活動時刻を非同期で更新する', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: AdminRoleType.ADMIN,
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

      const middleware = requireAdminRole([]);
      await middleware(req, res, next);

      expect(mockSessionService.updateActivity).toHaveBeenCalledWith('session-1');
    });

    it('updateActivityが失敗してもリクエストは継続する', async () => {
      const mockSession = {
        id: 'session-1',
        token: 'valid-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: AdminRoleType.ADMIN,
          totpEnabled: false,
        },
      };
      mockSessionService.validateSession.mockResolvedValue(mockSession);
      mockSessionService.updateActivity.mockRejectedValue(new Error('DB error'));

      const req = createMockReq({
        cookies: { admin_session: 'valid-token' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const middleware = requireAdminRole([]);
      await middleware(req, res, next);

      // updateActivityが失敗してもnextは呼ばれる
      expect(next).toHaveBeenCalledWith();
    });
  });
});
