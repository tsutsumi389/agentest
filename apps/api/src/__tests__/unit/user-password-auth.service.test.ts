import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserPasswordAuthService } from '../../services/user-password-auth.service.js';
import { AuthenticationError, AppError, BadRequestError } from '@agentest/shared';

// --- モック定義 ---

// bcryptモック（テスト高速化）
const mockBcrypt = vi.hoisted(() => ({
  hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  compare: vi.fn(),
}));
vi.mock('bcryptjs', () => ({ default: mockBcrypt }));

// JWTモック
const mockTokens = vi.hoisted(() => ({
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
}));
vi.mock('@agentest/auth', () => ({
  generateTokens: vi.fn().mockReturnValue(mockTokens),
}));

// hashTokenモック
vi.mock('../../utils/pkce.js', () => ({
  hashToken: vi.fn().mockReturnValue('hashed-token-value'),
}));

// cryptoモック（パスワードリセットトークン生成用）
const mockCrypto = vi.hoisted(() => ({
  randomBytes: vi.fn().mockReturnValue(Buffer.from('a'.repeat(32))),
}));
vi.mock('crypto', () => ({ default: mockCrypto, ...mockCrypto }));

// Redis storeモック（2FAトークン保存用）
const mockRedisStore = vi.hoisted(() => ({
  setUserTwoFactorToken: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../lib/redis-store.js', () => mockRedisStore);

// Prismaモック
const mockPrisma = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  session: {
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  emailVerificationToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma)),
}));
vi.mock('@agentest/db', () => ({ prisma: mockPrisma }));

// authConfigモック（persistAuthSessionは実装をそのまま使用）
vi.mock('../../config/auth.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../config/auth.js')>();
  return {
    ...actual,
    authConfig: {
      jwt: {
        accessSecret: 'test-access-secret',
        refreshSecret: 'test-refresh-secret',
        accessExpiry: '15m',
        refreshExpiry: '7d',
      },
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'strict',
        path: '/',
      },
      oauth: {},
    },
    SESSION_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,
  };
});

// envモック
const mockEnv = vi.hoisted(() => ({
  REQUIRE_EMAIL_VERIFICATION: true,
}));
vi.mock('../../config/env.js', () => ({ env: mockEnv }));

// loggerモック
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

// --- テストデータ ---

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: '$2b$12$existinghash',
  failedAttempts: 0,
  lockedUntil: null,
  deletedAt: null,
  avatarUrl: null,
  plan: 'FREE',
  emailVerified: true,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockOAuthOnlyUser = {
  ...mockUser,
  id: 'user-oauth',
  passwordHash: null,
};

// 2FA有効ユーザー
const mockUserWith2FA = {
  ...mockUser,
  id: 'user-2fa',
  totpEnabled: true,
};

// --- テスト ---

describe('UserPasswordAuthService', () => {
  let service: UserPasswordAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UserPasswordAuthService();
  });

  // ===========================================
  // hashPassword / verifyPassword
  // ===========================================
  describe('hashPassword', () => {
    it('パスワードをbcryptでハッシュ化できる', async () => {
      const result = await service.hashPassword('password123');

      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(result).toBe('$2b$12$hashedpassword');
    });

    it('同じパスワードから異なるハッシュが生成される（ランダムソルト）', async () => {
      // bcryptは内部でランダムソルトを使用するため、同じ入力でも異なるハッシュが生成される
      // モックでは同じ値を返すので、hashが2回呼ばれることを確認
      mockBcrypt.hash.mockResolvedValueOnce('$2b$12$hash1').mockResolvedValueOnce('$2b$12$hash2');

      const hash1 = await service.hashPassword('password123');
      const hash2 = await service.hashPassword('password123');

      expect(hash1).not.toBe(hash2);
      expect(mockBcrypt.hash).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyPassword', () => {
    it('正しいパスワードで検証が成功する', async () => {
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await service.verifyPassword('password123', '$2b$12$existinghash');

      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', '$2b$12$existinghash');
      expect(result).toBe(true);
    });

    it('間違ったパスワードで検証が失敗する', async () => {
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await service.verifyPassword('wrongpassword', '$2b$12$existinghash');

      expect(mockBcrypt.compare).toHaveBeenCalledWith('wrongpassword', '$2b$12$existinghash');
      expect(result).toBe(false);
    });
  });

  // ===========================================
  // register
  // ===========================================
  describe('register', () => {
    it('有効なデータで新規ユーザーを作成し、確認トークンを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null); // 重複なし
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(result.requiresEmailVerification).toBe(true);
      if (result.requiresEmailVerification) {
        expect(result.verificationToken).toBeTruthy();
      }
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('メールアドレスが重複する場合にエラーを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser); // 既に存在

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123!',
          name: 'Test User',
        })
      ).rejects.toThrow();
    });

    it('パスワードがハッシュ化されてDBに保存される（平文でない）', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      // user.createに渡されたデータでpasswordHashがハッシュ化された値であることを確認
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: '$2b$12$hashedpassword', // bcrypt.hashの戻り値
          }),
        })
      );
      // 平文パスワードが保存されていないことを確認
      expect(mockPrisma.user.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            passwordHash: 'Password123!',
          }),
        })
      );
    });
  });

  // ===========================================
  // login
  // ===========================================
  describe('login', () => {
    it('正しい認証情報でJWTトークンペアを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, failedAttempts: 0 });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
      });

      expect(result.requires2FA).toBe(false);
      if (!result.requires2FA) {
        expect(result.tokens).toEqual(mockTokens);
        expect(result.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        });
      }
    });

    it('メールアドレスが存在しない場合にAuthenticationErrorを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'notfound@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('パスワードが間違っている場合にAuthenticationErrorを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, failedAttempts: 1 });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('エラーメッセージが「メールアドレスまたはパスワードが正しくありません」で統一される', async () => {
      // ユーザー不存在時
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'notfound@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('メールアドレスまたはパスワードが正しくありません');

      vi.clearAllMocks();

      // パスワード間違い時
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, failedAttempts: 1 });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('メールアドレスまたはパスワードが正しくありません');
    });

    it('ユーザー不存在時もbcrypt比較を実行する（タイミング攻撃対策）', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'notfound@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(AuthenticationError);

      // ユーザーが存在しなくてもbcrypt.compareが呼ばれる（タイミング攻撃対策）
      expect(mockBcrypt.compare).toHaveBeenCalled();
    });

    it('ログイン失敗でfailedAttemptsがインクリメントされる', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, failedAttempts: 1 });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(AuthenticationError);

      // failedAttemptsがインクリメントされる
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            failedAttempts: { increment: 1 },
          }),
        })
      );
    });

    it('5回失敗でアカウントがロックされる（lockedUntilが設定される）', async () => {
      const userWith4Failures = { ...mockUser, failedAttempts: 4 };
      mockPrisma.user.findFirst.mockResolvedValue(userWith4Failures);
      mockBcrypt.compare.mockResolvedValue(false);
      // incrementの結果: 4 + 1 = 5
      mockPrisma.user.update.mockResolvedValueOnce({ ...userWith4Failures, failedAttempts: 5 });
      // ロック設定のupdate
      mockPrisma.user.update.mockResolvedValueOnce({
        ...userWith4Failures,
        failedAttempts: 5,
        lockedUntil: new Date(),
      });

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(AuthenticationError);

      // lockedUntilが設定される
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            lockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it('ロック中のユーザーがログインを試みるとロックエラーを返す', async () => {
      const lockedUser = {
        ...mockUser,
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30分後
      };
      mockPrisma.user.findFirst.mockResolvedValue(lockedUser);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(AuthenticationError);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('アカウントがロックされています');
    });

    it('ロック期間（30分）経過後はログインが可能になる', async () => {
      const expiredLockUser = {
        ...mockUser,
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // 1秒前（ロック期間終了済み）
      };
      mockPrisma.user.findFirst.mockResolvedValue(expiredLockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({
        ...expiredLockUser,
        failedAttempts: 0,
        lockedUntil: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.requires2FA).toBe(false);
      if (!result.requires2FA) {
        expect(result.tokens).toEqual(mockTokens);
      }
    });

    it('ロック期間終了時にfailedAttemptsとlockedUntilがリセットされる', async () => {
      const expiredLockUser = {
        ...mockUser,
        failedAttempts: 5,
        lockedUntil: new Date(Date.now() - 1000), // 1秒前（ロック期間終了済み）
      };
      mockPrisma.user.findFirst.mockResolvedValue(expiredLockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({
        ...expiredLockUser,
        failedAttempts: 0,
        lockedUntil: null,
      });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // ロック解除のupdateが呼ばれる（パスワード検証前にリセット）
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: { failedAttempts: 0, lockedUntil: null },
        })
      );
    });

    it('ログイン成功でfailedAttemptsがリセットされる', async () => {
      const userWithFailures = { ...mockUser, failedAttempts: 3 };
      mockPrisma.user.findFirst.mockResolvedValue(userWithFailures);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...userWithFailures, failedAttempts: 0 });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            failedAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });

    it('passwordHashがnull（OAuthのみユーザー）の場合にエラーを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockOAuthOnlyUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow(AuthenticationError);
    });
  });

  // ===========================================
  // requestPasswordReset
  // ===========================================
  describe('requestPasswordReset', () => {
    it('有効なユーザーに対してリセットトークンを生成する', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.requestPasswordReset('test@example.com');

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('トークンがSHA-256ハッシュ化されてDBに保存される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('test@example.com');

      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            tokenHash: 'hashed-token-value', // hashTokenモックの戻り値
          }),
        })
      );
    });

    it('有効期限が1時間後に設定される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      const before = Date.now();
      await service.requestPasswordReset('test@example.com');
      const after = Date.now();

      const createCall = mockPrisma.passwordResetToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const oneHourMs = 60 * 60 * 1000;

      // 有効期限が1時間後（±2秒の許容範囲）
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + oneHourMs - 2000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + oneHourMs + 2000);
    });

    it('ユーザーが存在しない場合もエラーを投げない（メール存在確認防止）', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await service.requestPasswordReset('notfound@example.com');

      // エラーを投げずにnullを返す
      expect(result).toBeNull();
    });

    it('passwordHashがnull（OAuthのみユーザー）の場合もエラーを投げない', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockOAuthOnlyUser);

      const result = await service.requestPasswordReset('test@example.com');

      // エラーを投げずにnullを返す
      expect(result).toBeNull();
    });

    it('生のトークン文字列を返す（メール送信用）', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.requestPasswordReset('test@example.com');

      // ハッシュ化されていない生のトークンが返される
      expect(result).toBeTruthy();
      expect(result).not.toBe('hashed-token-value'); // hashTokenの戻り値ではない
    });

    it('既存の未使用トークンが無効化される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('test@example.com');

      // 同一ユーザーの既存未使用トークンがusedAt設定で無効化される
      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, usedAt: null },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  // ===========================================
  // resetPassword
  // ===========================================
  describe('resetPassword', () => {
    const validResetToken = {
      id: 'token-1',
      userId: mockUser.id,
      tokenHash: 'hashed-token-value',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
      usedAt: null,
      createdAt: new Date(),
      user: mockUser,
    };

    it('有効なトークンで新しいパスワードを設定できる', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockPrisma.passwordResetToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({});

      await expect(service.resetPassword('raw-token', 'NewPassword123!')).resolves.not.toThrow();

      // パスワードがハッシュ化されて保存される
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            passwordHash: '$2b$12$hashedpassword',
          }),
        })
      );
    });

    it('トークンが使用済みとしてマークされる（usedAt設定）', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockPrisma.passwordResetToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({});

      await service.resetPassword('raw-token', 'NewPassword123!');

      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validResetToken.id },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        })
      );
    });

    it('期限切れトークンではエラーを返す', async () => {
      const expiredToken = {
        ...validResetToken,
        expiresAt: new Date(Date.now() - 1000), // 期限切れ
      };
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(expiredToken);

      await expect(service.resetPassword('raw-token', 'NewPassword123!')).rejects.toThrow();
    });

    it('存在しないトークンではエラーを返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('invalid-token', 'NewPassword123!')).rejects.toThrow();
    });

    it('既に使用済みのトークンではエラーを返す', async () => {
      const usedToken = {
        ...validResetToken,
        usedAt: new Date(), // 使用済み
      };
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(usedToken);

      await expect(service.resetPassword('raw-token', 'NewPassword123!')).rejects.toThrow();
    });

    it('パスワードリセット後にfailedAttemptsがリセットされる', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockPrisma.passwordResetToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({});

      await service.resetPassword('raw-token', 'NewPassword123!');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedAttempts: 0,
          }),
        })
      );
    });

    it('パスワードリセット後にlockedUntilがクリアされる', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockPrisma.passwordResetToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({});

      await service.resetPassword('raw-token', 'NewPassword123!');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lockedUntil: null,
          }),
        })
      );
    });

    it('パスワードリセット後に全セッション（RefreshToken）が無効化される', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockPrisma.passwordResetToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({});
      mockPrisma.session.updateMany.mockResolvedValue({});

      await service.resetPassword('raw-token', 'NewPassword123!');

      // RefreshTokenが無効化される
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.id,
            revokedAt: null,
          }),
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
          }),
        })
      );

      // Sessionが無効化される
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUser.id,
            revokedAt: null,
          }),
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
          }),
        })
      );
    });
  });

  // ===========================================
  // setPassword
  // ===========================================
  describe('setPassword', () => {
    it('OAuthのみユーザー（passwordHash=null）にパスワードを設定できる', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockOAuthOnlyUser);
      mockPrisma.user.update.mockResolvedValue({});

      await expect(service.setPassword('user-oauth', 'NewPassword123!')).resolves.not.toThrow();

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-oauth' },
          data: expect.objectContaining({
            passwordHash: '$2b$12$hashedpassword',
          }),
        })
      );
    });

    it('既にパスワードが設定されている場合はエラーを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser); // passwordHashがある

      await expect(service.setPassword('user-1', 'NewPassword123!')).rejects.toThrow();
    });
  });

  // ===========================================
  // changePassword
  // ===========================================
  describe('changePassword', () => {
    it('現在のパスワードが正しい場合に新しいパスワードに変更できる', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });

      await expect(
        service.changePassword('user-1', 'CurrentPassword123!', 'NewPassword456!')
      ).resolves.not.toThrow();

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            passwordHash: '$2b$12$hashedpassword',
          }),
        })
      );
    });

    it('他のセッションを無効化する', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 2 });

      await service.changePassword('user-1', 'CurrentPassword123!', 'NewPassword456!');

      // リフレッシュトークンの無効化が呼ばれる
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });

      // セッションの無効化が呼ばれる
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('currentTokenHashが指定された場合、現在のセッションを除外して無効化する', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.session.updateMany.mockResolvedValue({ count: 1 });

      const currentTokenHash = 'current-token-hash';
      await service.changePassword(
        'user-1',
        'CurrentPassword123!',
        'NewPassword456!',
        currentTokenHash
      );

      // 現在のセッションを除外してリフレッシュトークンを無効化
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
          tokenHash: { not: currentTokenHash },
        },
        data: { revokedAt: expect.any(Date) },
      });

      // 現在のセッションを除外してセッションを無効化
      expect(mockPrisma.session.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          revokedAt: null,
          tokenHash: { not: currentTokenHash },
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('現在のパスワードが間違っている場合にエラーを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.changePassword('user-1', 'WrongPassword!', 'NewPassword456!')
      ).rejects.toThrow(AuthenticationError);
    });

    it('passwordHashがnull（パスワード未設定）の場合にエラーを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockOAuthOnlyUser);

      await expect(
        service.changePassword('user-oauth', 'CurrentPassword123!', 'NewPassword456!')
      ).rejects.toThrow();
    });
  });

  // ===========================================
  // hasPassword
  // ===========================================
  describe('hasPassword', () => {
    it('パスワードが設定済みの場合にtrueを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const result = await service.hasPassword('user-1');

      expect(result).toBe(true);
    });

    it('パスワードが未設定（null）の場合にfalseを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockOAuthOnlyUser);

      const result = await service.hasPassword('user-oauth');

      expect(result).toBe(false);
    });
  });

  // ===========================================
  // register (メール確認フロー対応)
  // ===========================================
  describe('register (メール確認フロー)', () => {
    it('登録後にJWTを発行せず、RegisterResultを返す（メール認証あり）', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: false });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      // RegisterResult型（メール認証あり）: tokens ではなく verificationToken を持つ
      expect(result.requiresEmailVerification).toBe(true);
      if (result.requiresEmailVerification) {
        expect(result.verificationToken).toBeTruthy();
      }
      expect(result).toHaveProperty('user');
      expect(result).not.toHaveProperty('tokens');
    });

    it('EmailVerificationTokenがDBに作成される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: false });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            tokenHash: 'hashed-token-value',
          }),
        })
      );
    });

    it('確認トークンの有効期限が24時間後に設定される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: false });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      const before = Date.now();
      await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });
      const after = Date.now();

      const createCall = mockPrisma.emailVerificationToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt as Date;
      const twentyFourHoursMs = 24 * 60 * 60 * 1000;

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + twentyFourHoursMs - 2000);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + twentyFourHoursMs + 2000);
    });

    it('RefreshToken/Sessionは作成されない', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: false });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
      expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });
  });

  // ===========================================
  // register (メール認証スキップ)
  // ===========================================
  describe('register (メール認証スキップ)', () => {
    beforeEach(() => {
      mockEnv.REQUIRE_EMAIL_VERIFICATION = false;
    });

    afterEach(() => {
      mockEnv.REQUIRE_EMAIL_VERIFICATION = true;
    });

    it('emailVerified: true でユーザーが作成される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: true });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            emailVerified: true,
          }),
        })
      );
    });

    it('EmailVerificationToken が作成されない', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: true });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(mockPrisma.emailVerificationToken.create).not.toHaveBeenCalled();
    });

    it('requiresEmailVerification: false と tokens を返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: true });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(result.requiresEmailVerification).toBe(false);
      if (!result.requiresEmailVerification) {
        expect(result.tokens).toEqual(mockTokens);
      }
      expect(result.user).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        name: mockUser.name,
      });
    });

    it('RefreshToken と Session が作成される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...mockUser, emailVerified: true });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent',
      });

      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      expect(mockPrisma.session.create).toHaveBeenCalled();
    });
  });

  // ===========================================
  // verifyEmail
  // ===========================================
  describe('verifyEmail', () => {
    const validVerificationToken = {
      id: 'vtoken-1',
      userId: mockUser.id,
      tokenHash: 'hashed-token-value',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      usedAt: null,
      createdAt: new Date(),
      user: { ...mockUser, emailVerified: false },
    };

    it('有効なトークンでemailVerifiedをtrueに更新する', async () => {
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(validVerificationToken);
      mockPrisma.emailVerificationToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.verifyEmail('raw-verification-token');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            emailVerified: true,
          }),
        })
      );
    });

    it('トークンが使用済みとしてマークされる', async () => {
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(validVerificationToken);
      mockPrisma.emailVerificationToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await service.verifyEmail('raw-verification-token');

      expect(mockPrisma.emailVerificationToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: validVerificationToken.id },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        })
      );
    });

    it('存在しないトークンではエラーを返す', async () => {
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(BadRequestError);
    });

    it('期限切れトークンではエラーを返す', async () => {
      const expiredToken = {
        ...validVerificationToken,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(expiredToken);

      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestError);
    });

    it('使用済みトークンではエラーを返す', async () => {
      const usedToken = {
        ...validVerificationToken,
        usedAt: new Date(),
      };
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(usedToken);

      await expect(service.verifyEmail('used-token')).rejects.toThrow(BadRequestError);
    });

    it('既に確認済みのユーザーでもエラーにならない（冪等性）', async () => {
      const alreadyVerifiedToken = {
        ...validVerificationToken,
        user: { ...mockUser, emailVerified: true },
      };
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(alreadyVerifiedToken);
      mockPrisma.emailVerificationToken.update.mockResolvedValue({});
      mockPrisma.user.update.mockResolvedValue({});

      await expect(service.verifyEmail('raw-verification-token')).resolves.not.toThrow();
    });
  });

  // ===========================================
  // resendVerification
  // ===========================================
  describe('resendVerification', () => {
    const unverifiedUser = {
      ...mockUser,
      emailVerified: false,
    };

    it('未確認ユーザーに新しい確認トークンを生成する', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(unverifiedUser);
      mockPrisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      const result = await service.resendVerification('test@example.com');

      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('既存の未使用トークンが無効化される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(unverifiedUser);
      mockPrisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await service.resendVerification('test@example.com');

      expect(mockPrisma.emailVerificationToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: unverifiedUser.id, usedAt: null },
          data: expect.objectContaining({
            usedAt: expect.any(Date),
          }),
        })
      );
    });

    it('ユーザーが存在しない場合はnullを返す（メール存在確認防止）', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await service.resendVerification('notfound@example.com');

      expect(result).toBeNull();
    });

    it('既に確認済みのユーザーの場合はnullを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockUser, emailVerified: true });

      const result = await service.resendVerification('test@example.com');

      expect(result).toBeNull();
    });

    it('OAuthのみユーザー（passwordHash=null）の場合はnullを返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ ...mockOAuthOnlyUser, emailVerified: false });

      const result = await service.resendVerification('test@example.com');

      expect(result).toBeNull();
    });
  });

  // ===========================================
  // login (emailVerifiedチェック)
  // ===========================================
  describe('login (emailVerifiedチェック)', () => {
    it('未確認ユーザーのログインでEMAIL_NOT_VERIFIEDエラーを返す', async () => {
      const unverifiedUser = { ...mockUser, emailVerified: false };
      mockPrisma.user.findFirst.mockResolvedValue(unverifiedUser);
      mockBcrypt.compare.mockResolvedValue(true);

      try {
        await service.login({
          email: 'test@example.com',
          password: 'Password123!',
        });
        // ここに到達したらテスト失敗
        expect.unreachable('エラーがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('EMAIL_NOT_VERIFIED');
        expect((error as AppError).statusCode).toBe(401);
      }
    });

    it('確認済みユーザーは正常にログインできる', async () => {
      const verifiedUser = { ...mockUser, emailVerified: true };
      mockPrisma.user.findFirst.mockResolvedValue(verifiedUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...verifiedUser, failedAttempts: 0 });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.requires2FA).toBe(false);
      if (!result.requires2FA) {
        expect(result.tokens).toEqual(mockTokens);
      }
    });
  });

  // ===========================================
  // login (2FA対応)
  // ===========================================
  describe('login (2FA対応)', () => {
    it('2FA無効ユーザー: requires2FA: false + tokens + user を返す', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser); // totpEnabled: false
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, failedAttempts: 0 });
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.session.create.mockResolvedValue({});

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.requires2FA).toBe(false);
      if (!result.requires2FA) {
        expect(result.tokens).toEqual(mockTokens);
        expect(result.user).toEqual({
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        });
      }
    });

    it('2FA有効ユーザー: requires2FA: true + twoFactorToken を返す（JWTなし）', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserWith2FA);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...mockUserWith2FA, failedAttempts: 0 });

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.requires2FA).toBe(true);
      expect(result).toHaveProperty('twoFactorToken');
      expect(result).not.toHaveProperty('tokens');
      expect(result).not.toHaveProperty('user');
    });

    it('2FA有効ユーザー: twoFactorTokenがRedisに保存される', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserWith2FA);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...mockUserWith2FA, failedAttempts: 0 });

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // Redisに保存されることを確認
      expect(mockRedisStore.setUserTwoFactorToken).toHaveBeenCalledWith(
        mockUserWith2FA.id,
        expect.any(String)
      );
      // 返却されたトークンとRedisに保存されたトークンが一致
      const savedToken = mockRedisStore.setUserTwoFactorToken.mock.calls[0][1];
      expect((result as { twoFactorToken: string }).twoFactorToken).toBe(savedToken);
    });

    it('2FA有効ユーザー: RefreshToken/Sessionが作成されない', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUserWith2FA);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...mockUserWith2FA, failedAttempts: 0 });

      await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // JWTもRefreshToken/Sessionも作成されない
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
      expect(mockPrisma.session.create).not.toHaveBeenCalled();
    });

    it('2FA有効ユーザー: failedAttemptsがリセットされる', async () => {
      const userWith2FAAndFailures = { ...mockUserWith2FA, failedAttempts: 3 };
      mockPrisma.user.findFirst.mockResolvedValue(userWith2FAAndFailures);
      mockBcrypt.compare.mockResolvedValue(true);
      mockPrisma.user.update.mockResolvedValue({ ...userWith2FAAndFailures, failedAttempts: 0 });

      await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      // パスワード認証成功後にfailedAttemptsがリセットされる
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserWith2FA.id },
          data: expect.objectContaining({
            failedAttempts: 0,
            lockedUntil: null,
          }),
        })
      );
    });
  });
});
