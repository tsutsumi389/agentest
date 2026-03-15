import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// AdminPasswordResetService モック
const mockResetService = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../../services/admin/admin-password-reset.service.js', () => ({
  AdminPasswordResetService: vi.fn().mockImplementation(() => mockResetService),
}));

// EmailService モック
const mockEmailService = vi.hoisted(() => ({
  generatePasswordResetEmail: vi.fn(),
  send: vi.fn(),
}));

vi.mock('../../services/email.service.js', () => ({
  emailService: mockEmailService,
}));

// env モック
vi.mock('../../config/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    ADMIN_FRONTEND_URL: 'http://localhost:5174',
  },
}));

// Logger モック
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

// コントローラーのインポートはモック設定後
import { AdminPasswordResetController } from '../../controllers/admin/password-reset.controller.js';

// ヘルパー関数
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    body: {},
    ...overrides,
  } as Request;
}

function createMockRes(): Response {
  const res = {
    json: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('AdminPasswordResetController', () => {
  let controller: AdminPasswordResetController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminPasswordResetController();
  });

  describe('requestReset', () => {
    it('有効なメールアドレスでリセットメールを送信する', async () => {
      const req = createMockReq({ body: { email: 'admin@example.com' } });
      const res = createMockRes();
      const next = createMockNext();

      mockResetService.requestPasswordReset.mockResolvedValue({
        token: 'raw-token',
        adminUser: { id: 'admin-1', name: 'Test Admin' },
      });
      mockEmailService.generatePasswordResetEmail.mockReturnValue({
        subject: 'パスワードリセット',
        text: 'テキスト',
        html: '<html>リセット</html>',
      });
      mockEmailService.send.mockResolvedValue(undefined);

      await controller.requestReset(req, res, next);

      // リセットサービスが呼ばれる
      expect(mockResetService.requestPasswordReset).toHaveBeenCalledWith('admin@example.com');

      // メール生成が正しいパラメータで呼ばれる
      expect(mockEmailService.generatePasswordResetEmail).toHaveBeenCalledWith({
        name: 'Test Admin',
        resetUrl: 'http://localhost:5174/reset-password/raw-token',
        expiresInMinutes: 60,
      });

      // メール送信が呼ばれる
      expect(mockEmailService.send).toHaveBeenCalledWith({
        to: 'admin@example.com',
        subject: 'パスワードリセット',
        text: 'テキスト',
        html: '<html>リセット</html>',
      });

      // 同じレスポンスを返す
      expect(res.json).toHaveBeenCalledWith({
        message: 'メールアドレスが登録されている場合、パスワードリセット用のメールを送信しました',
      });
    });

    it('管理者が存在しない場合でも同じレスポンスを返す（メール列挙防止）', async () => {
      const req = createMockReq({ body: { email: 'unknown@example.com' } });
      const res = createMockRes();
      const next = createMockNext();

      mockResetService.requestPasswordReset.mockResolvedValue(null);

      await controller.requestReset(req, res, next);

      // メール送信は呼ばれない
      expect(mockEmailService.send).not.toHaveBeenCalled();

      // 同じレスポンスを返す
      expect(res.json).toHaveBeenCalledWith({
        message: 'メールアドレスが登録されている場合、パスワードリセット用のメールを送信しました',
      });
    });

    it('メール送信失敗時でも成功レスポンスを返す', async () => {
      const req = createMockReq({ body: { email: 'admin@example.com' } });
      const res = createMockRes();
      const next = createMockNext();

      mockResetService.requestPasswordReset.mockResolvedValue({
        token: 'raw-token',
        adminUser: { id: 'admin-1', name: 'Test Admin' },
      });
      mockEmailService.generatePasswordResetEmail.mockReturnValue({
        subject: 'test',
        text: 'test',
        html: '<html></html>',
      });
      mockEmailService.send.mockRejectedValue(new Error('SMTP error'));

      await controller.requestReset(req, res, next);

      // エラーログが記録される
      expect(mockLogger.error).toHaveBeenCalled();

      // 成功レスポンスを返す
      expect(res.json).toHaveBeenCalledWith({
        message: 'メールアドレスが登録されている場合、パスワードリセット用のメールを送信しました',
      });
    });

    it('無効なメールアドレスの場合、バリデーションエラーをnextに渡す', async () => {
      const req = createMockReq({ body: { email: 'invalid-email' } });
      const res = createMockRes();
      const next = createMockNext();

      await controller.requestReset(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '入力内容に誤りがあります',
        })
      );
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('有効なトークンとパスワードでリセットを実行する', async () => {
      const req = createMockReq({
        body: { token: 'valid-token', password: 'NewPassword123!' },
      });
      const res = createMockRes();
      const next = createMockNext();

      mockResetService.resetPassword.mockResolvedValue(undefined);

      await controller.resetPassword(req, res, next);

      expect(mockResetService.resetPassword).toHaveBeenCalledWith('valid-token', 'NewPassword123!');
      expect(res.json).toHaveBeenCalledWith({
        message: 'パスワードが正常にリセットされました。新しいパスワードでログインしてください',
      });
    });

    it('サービスがエラーを投げた場合、nextに渡す', async () => {
      const req = createMockReq({
        body: { token: 'invalid-token', password: 'NewPassword123!' },
      });
      const res = createMockRes();
      const next = createMockNext();

      const error = new Error('無効なトークン');
      mockResetService.resetPassword.mockRejectedValue(error);

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('パスワードが要件を満たさない場合、バリデーションエラーをnextに渡す', async () => {
      const req = createMockReq({
        body: { token: 'valid-token', password: 'weak' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '入力内容に誤りがあります',
        })
      );
      expect(mockResetService.resetPassword).not.toHaveBeenCalled();
    });

    it('トークンが空の場合、バリデーションエラーをnextに渡す', async () => {
      const req = createMockReq({
        body: { token: '', password: 'NewPassword123!' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '入力内容に誤りがあります',
        })
      );
    });
  });
});
