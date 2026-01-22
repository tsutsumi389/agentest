import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { AuthenticationError, ValidationError } from '@agentest/shared';

// AdminTotpService のモック
const mockTotpService = vi.hoisted(() => ({
  setupTotp: vi.fn(),
  enableTotp: vi.fn(),
  verifyTotp: vi.fn(),
  disableTotp: vi.fn(),
}));

vi.mock('../../services/admin/admin-totp.service.js', () => ({
  AdminTotpService: vi.fn().mockImplementation(() => mockTotpService),
}));

// extractClientInfo のモック
vi.mock('../../middleware/session.middleware.js', () => ({
  extractClientInfo: vi.fn().mockReturnValue({
    ipAddress: '127.0.0.1',
    userAgent: 'Test Browser',
  }),
}));

// モック設定後にインポート
import { AdminTotpController } from '../../controllers/admin/totp.controller.js';

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
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('AdminTotpController', () => {
  let controller: AdminTotpController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminTotpController();
  });

  describe('setup', () => {
    it('TOTPセットアップを開始し、QRコードを返す', async () => {
      const setupResult = {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCodeDataUrl: 'data:image/png;base64,mock',
        otpauthUrl: 'otpauth://...',
      };
      mockTotpService.setupTotp.mockResolvedValue(setupResult);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(mockTotpService.setupTotp).toHaveBeenCalledWith(
        'admin-1',
        'admin@example.com',
        '127.0.0.1',
        'Test Browser'
      );
      expect(res.json).toHaveBeenCalledWith(setupResult);
    });

    it('未認証の場合はAuthenticationError', async () => {
      const req = createMockReq({
        adminUser: undefined,
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.setup(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('enable', () => {
    it('正しいコードでTOTPを有効化できる', async () => {
      mockTotpService.enableTotp.mockResolvedValue(undefined);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
        body: { code: '123456' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.enable(req, res, next);

      expect(mockTotpService.enableTotp).toHaveBeenCalledWith(
        'admin-1',
        '123456',
        '127.0.0.1',
        'Test Browser'
      );
      expect(res.json).toHaveBeenCalledWith({
        message: '2要素認証が有効になりました',
      });
    });

    it('未認証の場合はAuthenticationError', async () => {
      const req = createMockReq({
        adminUser: undefined,
        body: { code: '123456' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.enable(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('コードが6桁でない場合はValidationError', async () => {
      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
        body: { code: '12345' }, // 5桁
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.enable(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('コードに数字以外が含まれる場合はValidationError', async () => {
      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: false,
        },
        body: { code: '12345a' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.enable(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });

  describe('verify', () => {
    it('正しいコードで検証成功', async () => {
      mockTotpService.verifyTotp.mockResolvedValue(true);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: true,
        },
        body: { code: '123456' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verify(req, res, next);

      expect(mockTotpService.verifyTotp).toHaveBeenCalledWith(
        'admin-1',
        '123456',
        '127.0.0.1',
        'Test Browser'
      );
      expect(res.json).toHaveBeenCalledWith({
        message: '2要素認証に成功しました',
        verified: true,
      });
    });

    it('未認証の場合はAuthenticationError', async () => {
      const req = createMockReq({
        adminUser: undefined,
        body: { code: '123456' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verify(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('コードが不正な場合はValidationError', async () => {
      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: true,
        },
        body: { code: '' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verify(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('サービスがエラーをスローした場合はnextに渡す', async () => {
      const authError = new AuthenticationError('TOTPコードが正しくありません');
      mockTotpService.verifyTotp.mockRejectedValue(authError);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: true,
        },
        body: { code: '000000' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verify(req, res, next);

      expect(next).toHaveBeenCalledWith(authError);
    });
  });

  describe('disable', () => {
    it('正しいパスワードでTOTPを無効化できる', async () => {
      mockTotpService.disableTotp.mockResolvedValue(undefined);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: true,
        },
        body: { password: 'correct-password' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.disable(req, res, next);

      expect(mockTotpService.disableTotp).toHaveBeenCalledWith(
        'admin-1',
        'correct-password',
        '127.0.0.1',
        'Test Browser'
      );
      expect(res.json).toHaveBeenCalledWith({
        message: '2要素認証が無効になりました',
      });
    });

    it('未認証の場合はAuthenticationError', async () => {
      const req = createMockReq({
        adminUser: undefined,
        body: { password: 'password' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.disable(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('パスワードが空の場合はValidationError', async () => {
      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: true,
        },
        body: { password: '' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.disable(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });

    it('サービスがエラーをスローした場合はnextに渡す', async () => {
      const authError = new AuthenticationError('パスワードが正しくありません');
      mockTotpService.disableTotp.mockRejectedValue(authError);

      const req = createMockReq({
        adminUser: {
          id: 'admin-1',
          email: 'admin@example.com',
          name: 'Test Admin',
          role: 'ADMIN',
          totpEnabled: true,
        },
        body: { password: 'wrong-password' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.disable(req, res, next);

      expect(next).toHaveBeenCalledWith(authError);
    });
  });
});
