import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

const TEST_USER_ID = 'user-123';

// サービスのモック
const mockPasswordAuthService = {
  hasPassword: vi.fn(),
  setPassword: vi.fn(),
  changePassword: vi.fn(),
};

vi.mock('../../services/user-password-auth.service.js', () => ({
  UserPasswordAuthService: vi.fn().mockImplementation(() => mockPasswordAuthService),
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
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }));
vi.mock('../../utils/pkce.js', () => ({
  hashToken: vi.fn((token: string) => `hashed-${token}`),
}));

// テスト対象のインポート（モック設定後）
import { UserPasswordController } from '../user-password.controller.js';

// ヘルパー関数
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID, email: 'test@example.com' } as any,
  params: { userId: TEST_USER_ID },
  body: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('UserPasswordController', () => {
  let controller: UserPasswordController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UserPasswordController();
    mockNext = vi.fn();
  });

  // ============================================
  // GET /api/users/:userId/password/status
  // ============================================
  describe('getPasswordStatus', () => {
    it('パスワード設定済みの場合 { hasPassword: true } を返す', async () => {
      mockPasswordAuthService.hasPassword.mockResolvedValue(true);
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPasswordStatus(req, res, mockNext);

      expect(mockPasswordAuthService.hasPassword).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ hasPassword: true });
    });

    it('パスワード未設定の場合 { hasPassword: false } を返す', async () => {
      mockPasswordAuthService.hasPassword.mockResolvedValue(false);
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPasswordStatus(req, res, mockNext);

      expect(mockPasswordAuthService.hasPassword).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ hasPassword: false });
    });

    it('サービスエラー時はnextにエラーを渡す', async () => {
      const error = new Error('DB error');
      mockPasswordAuthService.hasPassword.mockRejectedValue(error);
      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPasswordStatus(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ============================================
  // POST /api/users/:userId/password
  // ============================================
  describe('setPassword', () => {
    const validPassword = 'Test1234!';

    it('OAuthユーザーがパスワードを初回設定できる（201を返す）', async () => {
      mockPasswordAuthService.setPassword.mockResolvedValue(undefined);
      const req = mockRequest({
        body: { password: validPassword },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.setPassword(req, res, mockNext);

      expect(mockPasswordAuthService.setPassword).toHaveBeenCalledWith(TEST_USER_ID, validPassword);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ message: 'パスワードを設定しました' });
    });

    it('バリデーションエラー（パスワード要件不足）でnextにエラーを渡す', async () => {
      const req = mockRequest({
        body: { password: 'weak' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.setPassword(req, res, mockNext);

      expect(mockPasswordAuthService.setPassword).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('パスワードが未入力の場合はバリデーションエラーになる', async () => {
      const req = mockRequest({
        body: {},
      }) as Request;
      const res = mockResponse() as Response;

      await controller.setPassword(req, res, mockNext);

      expect(mockPasswordAuthService.setPassword).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('既にパスワード設定済みの場合はnextにConflictErrorを渡す', async () => {
      const { ConflictError } = await import('@agentest/shared');
      const error = new ConflictError('パスワードは既に設定されています');
      mockPasswordAuthService.setPassword.mockRejectedValue(error);
      const req = mockRequest({
        body: { password: validPassword },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.setPassword(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('サービスエラー時はnextにエラーを渡す', async () => {
      const error = new Error('DB error');
      mockPasswordAuthService.setPassword.mockRejectedValue(error);
      const req = mockRequest({
        body: { password: validPassword },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.setPassword(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  // ============================================
  // PUT /api/users/:userId/password
  // ============================================
  describe('changePassword', () => {
    const validBody = {
      currentPassword: 'OldPass123!',
      newPassword: 'NewPass456!',
    };

    it('正しい現在のパスワードで新しいパスワードに変更できる（200を返す）', async () => {
      mockPasswordAuthService.changePassword.mockResolvedValue(undefined);
      const req = mockRequest({
        body: validBody,
        cookies: { refresh_token: 'test-refresh-token' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockPasswordAuthService.changePassword).toHaveBeenCalledWith(
        TEST_USER_ID,
        validBody.currentPassword,
        validBody.newPassword,
        'hashed-test-refresh-token'
      );
      expect(res.json).toHaveBeenCalledWith({ message: 'パスワードを変更しました' });
    });

    it('リフレッシュトークンがない場合はcurrentTokenHashをundefinedで渡す', async () => {
      mockPasswordAuthService.changePassword.mockResolvedValue(undefined);
      const req = mockRequest({ body: validBody }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockPasswordAuthService.changePassword).toHaveBeenCalledWith(
        TEST_USER_ID,
        validBody.currentPassword,
        validBody.newPassword,
        undefined
      );
    });

    it('現在のパスワードが間違っている場合はnextにAuthenticationErrorを渡す', async () => {
      const { AuthenticationError } = await import('@agentest/shared');
      const error = new AuthenticationError('現在のパスワードが正しくありません');
      mockPasswordAuthService.changePassword.mockRejectedValue(error);
      const req = mockRequest({ body: validBody }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('バリデーションエラー（新しいパスワード要件不足）でnextにエラーを渡す', async () => {
      const req = mockRequest({
        body: { currentPassword: 'OldPass123!', newPassword: 'weak' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockPasswordAuthService.changePassword).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('currentPasswordが未入力の場合はバリデーションエラーになる', async () => {
      const req = mockRequest({
        body: { currentPassword: '', newPassword: 'NewPass456!' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockPasswordAuthService.changePassword).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    });

    it('パスワード未設定ユーザーの場合はnextにBadRequestErrorを渡す', async () => {
      const { BadRequestError } = await import('@agentest/shared');
      const error = new BadRequestError('パスワードが設定されていません');
      mockPasswordAuthService.changePassword.mockRejectedValue(error);
      const req = mockRequest({ body: validBody }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('サービスエラー時はnextにエラーを渡す', async () => {
      const error = new Error('DB error');
      mockPasswordAuthService.changePassword.mockRejectedValue(error);
      const req = mockRequest({ body: validBody }) as Request;
      const res = mockResponse() as Response;

      await controller.changePassword(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
