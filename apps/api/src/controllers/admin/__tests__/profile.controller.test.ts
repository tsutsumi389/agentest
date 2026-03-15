import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const TEST_ADMIN_ID = 'admin-123';

// サービスのモック
const mockAuthService = {
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
};

vi.mock('../../../services/admin/admin-auth.service.js', () => ({
  AdminAuthService: vi.fn().mockImplementation(() => mockAuthService),
}));

// extractClientInfoのモック
vi.mock('../../../middleware/session.middleware.js', () => ({
  extractClientInfo: vi.fn().mockReturnValue({
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
  }),
}));

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../../utils/logger.js', () => ({ logger: mockLogger }));

// テスト対象のインポート（モック設定後）
import { AdminProfileController } from '../profile.controller.js';

// ヘルパー関数
const mockRequest = (overrides = {}): Partial<Request> => ({
  adminUser: {
    id: TEST_ADMIN_ID,
    email: 'admin@example.com',
    name: 'Admin',
    role: 'ADMIN',
    totpEnabled: false,
  } as any,
  adminSession: {
    id: 'session-123',
    token: 'test-token',
    createdAt: new Date(),
  } as any,
  body: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  return res;
};

describe('AdminProfileController', () => {
  let controller: AdminProfileController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminProfileController();
    mockNext = vi.fn();
  });

  // ============================================
  // PATCH /admin/auth/profile
  // ============================================
  describe('updateProfile', () => {
    it('名前を更新し、更新後のadmin情報を返す', async () => {
      const updatedAdmin = {
        id: TEST_ADMIN_ID,
        email: 'admin@example.com',
        name: '新しい名前',
        role: 'ADMIN',
        totpEnabled: false,
      };
      mockAuthService.updateProfile.mockResolvedValue(updatedAdmin);
      const req = mockRequest({ body: { name: '新しい名前' } }) as Request;
      const res = mockResponse() as Response;

      await controller.updateProfile(req, res, mockNext);

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(
        TEST_ADMIN_ID,
        '新しい名前',
        '127.0.0.1',
        'TestAgent/1.0'
      );
      expect(res.json).toHaveBeenCalledWith({ admin: updatedAdmin });
    });

    it('nameが空の場合はバリデーションエラー', async () => {
      const req = mockRequest({ body: { name: '' } }) as Request;
      const res = mockResponse() as Response;

      await controller.updateProfile(req, res, mockNext);

      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('nameが未入力の場合はバリデーションエラー', async () => {
      const req = mockRequest({ body: {} }) as Request;
      const res = mockResponse() as Response;

      await controller.updateProfile(req, res, mockNext);

      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('nameが100文字超の場合はバリデーションエラー', async () => {
      const req = mockRequest({ body: { name: 'a'.repeat(101) } }) as Request;
      const res = mockResponse() as Response;

      await controller.updateProfile(req, res, mockNext);

      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('adminUserがない場合はAuthenticationError', async () => {
      const req = mockRequest({ adminUser: undefined }) as Request;
      const res = mockResponse() as Response;

      await controller.updateProfile(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('サービスエラー時はnextにエラーを渡す', async () => {
      const error = new Error('DB error');
      mockAuthService.updateProfile.mockRejectedValue(error);
      const req = mockRequest({ body: { name: 'New Name' } }) as Request;
      const res = mockResponse() as Response;

      await controller.updateProfile(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ============================================
  // PUT /admin/auth/password
  // ============================================
  describe('changePassword', () => {
    const validBody = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    };

    it('正しいパスワードで変更に成功する', async () => {
      mockAuthService.changePassword.mockResolvedValue(undefined);
      const req = mockRequest({ body: validBody }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        TEST_ADMIN_ID,
        validBody.currentPassword,
        validBody.newPassword,
        '127.0.0.1',
        'TestAgent/1.0',
        'session-123'
      );
      expect(res.json).toHaveBeenCalledWith({ message: 'パスワードを変更しました' });
    });

    it('新しいパスワードが要件不足の場合はバリデーションエラー', async () => {
      const req = mockRequest({
        body: { currentPassword: 'OldPass123!', newPassword: 'weak' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('currentPasswordが空の場合はバリデーションエラー', async () => {
      const req = mockRequest({
        body: { currentPassword: '', newPassword: 'NewPass456!' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('同じパスワードの場合はバリデーションエラー', async () => {
      const req = mockRequest({
        body: { currentPassword: 'SamePass123!', newPassword: 'SamePass123!' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockAuthService.changePassword).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('adminUserがない場合はAuthenticationError', async () => {
      const req = mockRequest({ adminUser: undefined, body: validBody }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('サービスエラー時はnextにエラーを渡す', async () => {
      const { AuthenticationError } = await import('@agentest/shared');
      const error = new AuthenticationError('現在のパスワードが正しくありません');
      mockAuthService.changePassword.mockRejectedValue(error);
      const req = mockRequest({ body: validBody }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
