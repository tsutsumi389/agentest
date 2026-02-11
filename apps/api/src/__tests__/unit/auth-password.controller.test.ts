import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  AuthenticationError,
  ValidationError,
  ConflictError,
  BadRequestError,
} from '@agentest/shared';

// Logger のモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});
vi.mock('../../utils/logger.js', () => ({ logger: mockLogger }));

// UserPasswordAuthService のモック
const mockPasswordAuthService = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock('../../services/user-password-auth.service.js', () => ({
  UserPasswordAuthService: vi.fn().mockImplementation(() => mockPasswordAuthService),
}));

// UserTotpService のモック
const mockTotpService = vi.hoisted(() => ({
  verifyTotp: vi.fn(),
}));

vi.mock('../../services/user-totp.service.js', () => ({
  UserTotpService: vi.fn().mockImplementation(() => mockTotpService),
}));

// Redis store のモック（2FA認証用）
const mockRedisStore = vi.hoisted(() => ({
  getUserIdByTwoFactorToken: vi.fn(),
  deleteUserTwoFactorToken: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../lib/redis-store.js', () => mockRedisStore);

// EmailService のモック
const mockEmailService = vi.hoisted(() => ({
  send: vi.fn(),
  generatePasswordResetEmail: vi.fn(),
  generateWelcomeEmail: vi.fn(),
  generateEmailVerificationEmail: vi.fn(),
}));

vi.mock('../../services/email.service.js', () => ({
  emailService: mockEmailService,
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
    JWT_ACCESS_SECRET: 'test-access-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    FRONTEND_URL: 'http://localhost:5173',
    TOKEN_ENCRYPTION_KEY: 'test-encryption-key-32chars12345',
  },
}));

// @agentest/auth のモック
const mockGenerateTokens = vi.hoisted(() => vi.fn().mockReturnValue({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
}));
vi.mock('@agentest/auth', () => ({
  generateTokens: mockGenerateTokens,
  verifyRefreshToken: vi.fn(),
  passport: {},
  requireAuth: vi.fn(),
}));

// @agentest/db のモック
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  refreshToken: { create: vi.fn() },
  session: { create: vi.fn() },
  $transaction: vi.fn(),
}));
// $transaction はコールバックに prisma 自身を渡す
mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma));
vi.mock('@agentest/db', () => ({ prisma: mockPrisma }));

// pkce のモック
vi.mock('../../utils/pkce.js', () => ({
  hashToken: vi.fn().mockReturnValue('hashed-token'),
}));

// crypto のモック
vi.mock('../../utils/crypto.js', () => ({
  encryptToken: vi.fn(),
}));

// SessionService のモック
const mockSessionService = vi.hoisted(() => ({
  createSession: vi.fn(),
}));

vi.mock('../../services/session.service.js', () => ({
  SessionService: vi.fn().mockImplementation(() => mockSessionService),
}));

// コントローラーのインポートはモック設定後
import { AuthController } from '../../controllers/auth.controller.js';

// ヘルパー関数
function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    cookies: {},
    body: {},
    headers: {},
    user: undefined,
    ...overrides,
  } as Request;
}

function createMockRes(): Response {
  return {
    json: vi.fn().mockReturnThis(),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('AuthController - パスワード認証', () => {
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController();
  });

  // ===== POST /api/auth/login =====
  describe('login', () => {
    it('正しい認証情報でトークンクッキーが設定され200を返す', async () => {
      mockPasswordAuthService.login.mockResolvedValue({
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'テストユーザー',
        },
      });

      const req = createMockReq({
        body: {
          email: 'user@example.com',
          password: 'Password1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      // クッキー設定の確認
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock-access-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh-token',
        expect.objectContaining({
          httpOnly: true,
          path: '/',
        })
      );

      // ユーザー情報のレスポンス確認
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'テストユーザー',
        },
      });
    });

    it('バリデーションエラー（不正なメール形式）で400を返す', async () => {
      const req = createMockReq({
        body: {
          email: 'invalid-email',
          password: 'Password1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockPasswordAuthService.login).not.toHaveBeenCalled();
    });

    it('認証失敗で401を返す', async () => {
      const authError = new AuthenticationError('メールアドレスまたはパスワードが正しくありません');
      mockPasswordAuthService.login.mockRejectedValue(authError);

      const req = createMockReq({
        body: {
          email: 'user@example.com',
          password: 'WrongPassword1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(authError);
    });

    it('アカウントロック中は401を返す', async () => {
      const lockError = new AuthenticationError('アカウントがロックされています。しばらく経ってから再度お試しください');
      mockPasswordAuthService.login.mockRejectedValue(lockError);

      const req = createMockReq({
        body: {
          email: 'user@example.com',
          password: 'Password1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      expect(next).toHaveBeenCalledWith(lockError);
    });

    it('レスポンスにユーザー情報（id, email, name）が含まれる', async () => {
      mockPasswordAuthService.login.mockResolvedValue({
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
        user: {
          id: 'user-123',
          email: 'test@example.com',
          name: 'テスト太郎',
        },
      });

      const req = createMockReq({
        body: {
          email: 'test@example.com',
          password: 'Password1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseBody.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        name: 'テスト太郎',
      });
    });
  });

  // ===== POST /api/auth/register =====
  describe('register', () => {
    it('有効なデータでユーザーが作成され201を返す', async () => {
      mockPasswordAuthService.register.mockResolvedValue({
        verificationToken: 'mock-verification-token',
        user: {
          id: 'user-new',
          email: 'newuser@example.com',
          name: '新規ユーザー',
        },
      });
      mockEmailService.generateEmailVerificationEmail.mockReturnValue({
        subject: '確認',
        text: '確認',
        html: '<p>確認</p>',
      });
      mockEmailService.send.mockResolvedValue(undefined);

      const req = createMockReq({
        body: {
          email: 'newuser@example.com',
          password: 'Password1!',
          name: '新規ユーザー',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.register(req, res, next);

      // 非同期メール送信を待つ
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: expect.stringContaining('確認メール'),
        user: {
          id: 'user-new',
          email: 'newuser@example.com',
          name: '新規ユーザー',
        },
      });
    });

    it('確認メールが送信される（クッキーは設定されない）', async () => {
      mockPasswordAuthService.register.mockResolvedValue({
        verificationToken: 'mock-verification-token',
        user: {
          id: 'user-new',
          email: 'newuser@example.com',
          name: '新規ユーザー',
        },
      });
      mockEmailService.generateEmailVerificationEmail.mockReturnValue({
        subject: '確認',
        text: '確認',
        html: '<p>確認</p>',
      });
      mockEmailService.send.mockResolvedValue(undefined);

      const req = createMockReq({
        body: {
          email: 'newuser@example.com',
          password: 'Password1!',
          name: '新規ユーザー',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.register(req, res, next);

      // 非同期メール送信を待つ
      await new Promise(resolve => setTimeout(resolve, 0));

      // クッキーは設定されない（メール確認が必要）
      expect(res.cookie).not.toHaveBeenCalled();
      // 確認メールが送信される
      expect(mockEmailService.generateEmailVerificationEmail).toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('バリデーションエラー（パスワード要件不足）で400を返す', async () => {
      const req = createMockReq({
        body: {
          email: 'newuser@example.com',
          password: 'weak', // パスワード要件を満たさない
          name: '新規ユーザー',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.register(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockPasswordAuthService.register).not.toHaveBeenCalled();
    });

    it('メールアドレス重複で409を返す', async () => {
      const conflictError = new ConflictError('このメールアドレスは既に登録されています');
      mockPasswordAuthService.register.mockRejectedValue(conflictError);

      const req = createMockReq({
        body: {
          email: 'existing@example.com',
          password: 'Password1!',
          name: '重複ユーザー',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.register(req, res, next);

      expect(next).toHaveBeenCalledWith(conflictError);
    });

    it('レスポンスにユーザー情報が含まれる', async () => {
      mockPasswordAuthService.register.mockResolvedValue({
        verificationToken: 'mock-verification-token',
        user: {
          id: 'user-reg',
          email: 'reg@example.com',
          name: '登録ユーザー',
        },
      });
      mockEmailService.generateEmailVerificationEmail.mockReturnValue({
        subject: '確認',
        text: '確認',
        html: '<p>確認</p>',
      });
      mockEmailService.send.mockResolvedValue(undefined);

      const req = createMockReq({
        body: {
          email: 'reg@example.com',
          password: 'Password1!',
          name: '登録ユーザー',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.register(req, res, next);

      const responseBody = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseBody.user).toEqual({
        id: 'user-reg',
        email: 'reg@example.com',
        name: '登録ユーザー',
      });
    });
  });

  // ===== POST /api/auth/forgot-password =====
  describe('forgotPassword', () => {
    it('有効なメールアドレスで200を返す（ユーザー存在時）', async () => {
      mockPasswordAuthService.requestPasswordReset.mockResolvedValue('reset-token-abc');
      mockEmailService.generatePasswordResetEmail.mockReturnValue({
        subject: 'パスワードリセット',
        text: 'リセットリンク',
        html: '<p>リセットリンク</p>',
      });
      mockEmailService.send.mockResolvedValue(undefined);

      const req = createMockReq({
        body: { email: 'user@example.com' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.forgotPassword(req, res, next);

      // レスポンスは即座に返される（fire-and-forget）
      expect(res.json).toHaveBeenCalledWith({
        message: 'パスワードリセット用のメールを送信しました。メールをご確認ください。',
      });

      // 非同期処理の完了を待つ（fire-and-forget）
      await new Promise(resolve => setTimeout(resolve, 0));

      // メール送信が呼ばれたことを確認
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('存在しないメールアドレスでも200を返す（メール存在確認防止）', async () => {
      mockPasswordAuthService.requestPasswordReset.mockResolvedValue(null);

      const req = createMockReq({
        body: { email: 'nonexistent@example.com' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.forgotPassword(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        message: 'パスワードリセット用のメールを送信しました。メールをご確認ください。',
      });
      // メール送信は呼ばれない
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('バリデーションエラーで400を返す', async () => {
      const req = createMockReq({
        body: { email: 'invalid-email' },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.forgotPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockPasswordAuthService.requestPasswordReset).not.toHaveBeenCalled();
    });

    it('レスポンスに共通のメッセージが含まれる', async () => {
      // ユーザーが存在する場合
      mockPasswordAuthService.requestPasswordReset.mockResolvedValue('token');
      mockEmailService.generatePasswordResetEmail.mockReturnValue({
        subject: 'リセット',
        text: 'リセット',
        html: '<p>リセット</p>',
      });
      mockEmailService.send.mockResolvedValue(undefined);

      const req1 = createMockReq({ body: { email: 'exists@example.com' } });
      const res1 = createMockRes();
      const next1 = createMockNext();
      await controller.forgotPassword(req1, res1, next1);

      // 非同期処理の完了を待つ（fire-and-forget）
      await new Promise(resolve => setTimeout(resolve, 0));

      // ユーザーが存在しない場合
      mockPasswordAuthService.requestPasswordReset.mockResolvedValue(null);

      const req2 = createMockReq({ body: { email: 'noexist@example.com' } });
      const res2 = createMockRes();
      const next2 = createMockNext();
      await controller.forgotPassword(req2, res2, next2);

      // 同じメッセージを返すことを確認
      const message1 = (res1.json as ReturnType<typeof vi.fn>).mock.calls[0][0].message;
      const message2 = (res2.json as ReturnType<typeof vi.fn>).mock.calls[0][0].message;
      expect(message1).toBe(message2);
    });
  });

  // ===== POST /api/auth/reset-password =====
  describe('resetPassword', () => {
    it('有効なトークンと新パスワードで200を返す', async () => {
      mockPasswordAuthService.resetPassword.mockResolvedValue(undefined);

      const req = createMockReq({
        body: {
          token: 'valid-reset-token',
          password: 'NewPassword1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.resetPassword(req, res, next);

      expect(mockPasswordAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'NewPassword1!'
      );
      expect(res.json).toHaveBeenCalledWith({
        message: 'パスワードがリセットされました。新しいパスワードでログインしてください。',
      });
    });

    it('無効なトークンで400を返す', async () => {
      const badRequestError = new BadRequestError('無効なパスワードリセットトークンです');
      mockPasswordAuthService.resetPassword.mockRejectedValue(badRequestError);

      const req = createMockReq({
        body: {
          token: 'invalid-token',
          password: 'NewPassword1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(badRequestError);
    });

    it('期限切れトークンで400を返す', async () => {
      const expiredError = new BadRequestError('パスワードリセットトークンの有効期限が切れています');
      mockPasswordAuthService.resetPassword.mockRejectedValue(expiredError);

      const req = createMockReq({
        body: {
          token: 'expired-token',
          password: 'NewPassword1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expiredError);
    });

    it('パスワード要件を満たさない場合は400を返す', async () => {
      const req = createMockReq({
        body: {
          token: 'valid-token',
          password: 'weak', // パスワード要件を満たさない
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.resetPassword(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      expect(mockPasswordAuthService.resetPassword).not.toHaveBeenCalled();
    });
  });

  // ===== POST /api/auth/login (2FA対応) =====
  describe('login (2FA対応)', () => {
    it('2FA有効ユーザー: クッキー未設定、requires2FA + twoFactorToken レスポンス', async () => {
      mockPasswordAuthService.login.mockResolvedValue({
        requires2FA: true,
        twoFactorToken: 'mock-2fa-token',
      });

      const req = createMockReq({
        body: {
          email: 'user@example.com',
          password: 'Password1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      // クッキーは設定されない
      expect(res.cookie).not.toHaveBeenCalled();

      // requires2FA + twoFactorToken レスポンス
      expect(res.json).toHaveBeenCalledWith({
        requires2FA: true,
        twoFactorToken: 'mock-2fa-token',
      });
    });

    it('2FA無効ユーザー: 従来通りクッキーにJWT設定', async () => {
      mockPasswordAuthService.login.mockResolvedValue({
        requires2FA: false,
        tokens: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
        },
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'テストユーザー',
        },
      });

      const req = createMockReq({
        body: {
          email: 'user@example.com',
          password: 'Password1!',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.login(req, res, next);

      // クッキーが設定される
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock-access-token',
        expect.any(Object)
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh-token',
        expect.any(Object)
      );

      // ユーザー情報レスポンス
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'テストユーザー',
        },
      });
    });
  });

  // ===== POST /api/auth/2fa/verify =====
  describe('verifyTwoFactor', () => {
    it('正しいtwoFactorToken + code で JWT設定 + ユーザー情報返却', async () => {
      mockRedisStore.getUserIdByTwoFactorToken.mockResolvedValue('user-1');
      mockTotpService.verifyTotp.mockResolvedValue(true);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'テストユーザー',
        avatarUrl: null,
        plan: 'free',
        createdAt: new Date('2024-01-01'),
        totpEnabled: true,
        deletedAt: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const req = createMockReq({
        body: {
          twoFactorToken: 'valid-2fa-token',
          code: '123456',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verifyTwoFactor(req, res, next);

      // クッキーにJWT設定
      expect(res.cookie).toHaveBeenCalledWith(
        'access_token',
        'mock-access-token',
        expect.any(Object)
      );
      expect(res.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'mock-refresh-token',
        expect.any(Object)
      );

      // ユーザー情報返却
      expect(res.json).toHaveBeenCalledWith({
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'テストユーザー',
          avatarUrl: null,
          plan: 'free',
          createdAt: new Date('2024-01-01'),
          totpEnabled: true,
        },
      });

      // トランザクションでDB操作が実行される
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('無効なtwoFactorTokenでAuthenticationError', async () => {
      mockRedisStore.getUserIdByTwoFactorToken.mockResolvedValue(null);

      const req = createMockReq({
        body: {
          twoFactorToken: 'invalid-token',
          code: '123456',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verifyTwoFactor(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('TOTPコード不正でエラーがnextに渡される（トークンは消費済み）', async () => {
      mockRedisStore.getUserIdByTwoFactorToken.mockResolvedValue('user-1');
      const authError = new AuthenticationError('TOTPコードが正しくありません');
      mockTotpService.verifyTotp.mockRejectedValue(authError);

      const req = createMockReq({
        body: {
          twoFactorToken: 'valid-2fa-token',
          code: '000000',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verifyTwoFactor(req, res, next);

      expect(next).toHaveBeenCalledWith(authError);
      // トークンは検証前に削除されているので、失敗時でも消費済み
      expect(mockRedisStore.deleteUserTwoFactorToken).toHaveBeenCalledWith('valid-2fa-token');
    });

    it('検証前にRedis 2FAトークンが削除される（ワンタイム使用保証）', async () => {
      // deleteUserTwoFactorToken の呼び出し順序を検証
      const callOrder: string[] = [];
      mockRedisStore.deleteUserTwoFactorToken.mockImplementation(async () => {
        callOrder.push('deleteToken');
        return true;
      });
      mockTotpService.verifyTotp.mockImplementation(async () => {
        callOrder.push('verifyTotp');
        return true;
      });
      mockRedisStore.getUserIdByTwoFactorToken.mockResolvedValue('user-1');
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
        name: 'テストユーザー',
        totpEnabled: true,
        deletedAt: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const req = createMockReq({
        body: {
          twoFactorToken: 'valid-2fa-token',
          code: '123456',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verifyTwoFactor(req, res, next);

      expect(mockRedisStore.deleteUserTwoFactorToken).toHaveBeenCalledWith('valid-2fa-token');
      // トークン削除はTOTP検証より前に実行される
      expect(callOrder).toEqual(['deleteToken', 'verifyTotp']);
    });

    it('twoFactorTokenが未指定の場合はValidationError', async () => {
      const req = createMockReq({
        body: {
          code: '123456',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verifyTwoFactor(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('codeが未指定の場合はValidationError', async () => {
      const req = createMockReq({
        body: {
          twoFactorToken: 'valid-token',
        },
      });
      const res = createMockRes();
      const next = createMockNext();

      await controller.verifyTwoFactor(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
