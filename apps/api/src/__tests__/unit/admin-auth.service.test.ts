import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthenticationError } from '@agentest/shared';

// bcryptモック（vi.hoistedを使用）
const mockBcrypt = vi.hoisted(() => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: (pwd: string, rounds: number) => mockBcrypt.hash(pwd, rounds),
    compare: (pwd: string, hash: string) => mockBcrypt.compare(pwd, hash),
  },
}));

// AdminUserRepository のモック（vi.hoistedを使用）
const mockUserRepo = vi.hoisted(() => ({
  findByEmailWithPassword: vi.fn(),
  findById: vi.fn(),
  incrementFailedAttempts: vi.fn(),
  lockAccount: vi.fn(),
  resetFailedAttempts: vi.fn(),
}));

vi.mock('../../repositories/admin-user.repository.js', () => ({
  AdminUserRepository: vi.fn().mockImplementation(() => mockUserRepo),
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

// AdminAuditLogService のモック（vi.hoistedを使用）
const mockAuditLogService = vi.hoisted(() => ({
  log: vi.fn(),
}));

vi.mock('../../services/admin/admin-audit-log.service.js', () => ({
  AdminAuditLogService: vi.fn().mockImplementation(() => mockAuditLogService),
}));

// サービスのインポートはモック設定後
import { AdminAuthService } from '../../services/admin/admin-auth.service.js';

describe('AdminAuthService', () => {
  let service: AdminAuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminAuthService();
  });

  describe('hashPassword', () => {
    it('パスワードをハッシュ化できる（BCRYPT_ROUNDS=12）', async () => {
      mockBcrypt.hash.mockResolvedValue('hashed-password');

      const result = await service.hashPassword('TestPassword123!');

      expect(mockBcrypt.hash).toHaveBeenCalledWith('TestPassword123!', 12);
      expect(result).toBe('hashed-password');
    });
  });

  describe('login', () => {
    const validUser = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Test Admin',
      passwordHash: '$2b$12$validhash',
      role: 'ADMIN',
      totpEnabled: false,
      failedAttempts: 0,
      lockedUntil: null,
    };

    const mockSession = {
      id: 'session-1',
      token: 'session-token',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    };

    it('正しい認証情報でログインできる', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockUserRepo.resetFailedAttempts.mockResolvedValue(undefined);
      mockSessionService.createSession.mockResolvedValue(mockSession);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await service.login({
        email: 'admin@example.com',
        password: 'correct-password',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });

      expect(result.admin.id).toBe('admin-1');
      expect(result.admin.email).toBe('admin@example.com');
      expect(result.session.token).toBe('session-token');
    });

    it('ログイン成功時に失敗回数をリセットする', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        ...validUser,
        failedAttempts: 3,
      });
      mockBcrypt.compare.mockResolvedValue(true);
      mockSessionService.createSession.mockResolvedValue(mockSession);

      await service.login({
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(mockUserRepo.resetFailedAttempts).toHaveBeenCalledWith('admin-1');
    });

    it('ログイン成功時に監査ログを記録する（LOGIN_SUCCESS）', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockSessionService.createSession.mockResolvedValue(mockSession);

      await service.login({
        email: 'admin@example.com',
        password: 'correct-password',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGIN_SUCCESS',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Browser',
        })
      );
    });

    it('存在しないユーザーで認証エラー', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'any-password',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('タイミング攻撃対策: ユーザー不在でもbcrypt.compareを実行する', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'nonexistent@example.com',
          password: 'any-password',
        })
      ).rejects.toThrow(AuthenticationError);

      // ダミーハッシュに対してcompareが呼ばれることを確認
      expect(mockBcrypt.compare).toHaveBeenCalledWith(
        'any-password',
        expect.stringMatching(/^\$2b\$12\$/)
      );
    });

    it('不正パスワードで認証エラー', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(false);
      mockUserRepo.incrementFailedAttempts.mockResolvedValue({ failedAttempts: 1 });

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'wrong-password',
        })
      ).rejects.toThrow(AuthenticationError);
    });

    it('不正パスワード時に失敗回数をインクリメント', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(false);
      mockUserRepo.incrementFailedAttempts.mockResolvedValue({ failedAttempts: 1 });

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'wrong-password',
        })
      ).rejects.toThrow(AuthenticationError);

      expect(mockUserRepo.incrementFailedAttempts).toHaveBeenCalledWith('admin-1');
    });

    it('不正パスワード時に監査ログを記録する（LOGIN_FAILED）', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue(validUser);
      mockBcrypt.compare.mockResolvedValue(false);
      mockUserRepo.incrementFailedAttempts.mockResolvedValue({ failedAttempts: 1 });

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'wrong-password',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Browser',
        })
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGIN_FAILED',
          details: expect.objectContaining({
            reason: 'invalid_password',
          }),
        })
      );
    });

    it('5回失敗でアカウントをロックする', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        ...validUser,
        failedAttempts: 4,
      });
      mockBcrypt.compare.mockResolvedValue(false);
      mockUserRepo.incrementFailedAttempts.mockResolvedValue({ failedAttempts: 5 });
      mockUserRepo.lockAccount.mockResolvedValue(undefined);

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'wrong-password',
        })
      ).rejects.toThrow(AuthenticationError);

      expect(mockUserRepo.lockAccount).toHaveBeenCalledWith(
        'admin-1',
        expect.any(Date)
      );

      // ロック時間が約30分後であることを確認
      const lockCall = mockUserRepo.lockAccount.mock.calls[0];
      const lockUntil = lockCall[1].getTime();
      const expectedLock = Date.now() + 30 * 60 * 1000;
      expect(Math.abs(lockUntil - expectedLock)).toBeLessThan(1000);
    });

    it('アカウントロック時に監査ログを記録（ACCOUNT_LOCKED）', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        ...validUser,
        failedAttempts: 4,
      });
      mockBcrypt.compare.mockResolvedValue(false);
      mockUserRepo.incrementFailedAttempts.mockResolvedValue({ failedAttempts: 5 });
      mockUserRepo.lockAccount.mockResolvedValue(undefined);

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'wrong-password',
        })
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'ACCOUNT_LOCKED',
          details: expect.objectContaining({
            failedAttempts: 5,
          }),
        })
      );
    });

    it('ロック中ユーザーはログイン拒否', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        ...validUser,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000), // 30分後まで
      });

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'correct-password',
        })
      ).rejects.toThrow('アカウントがロックされています');

      // パスワード検証が行われないことを確認
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('ロック中ログイン試行で監査ログを記録（LOGIN_BLOCKED_LOCKED）', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        ...validUser,
        lockedUntil: new Date(Date.now() + 30 * 60 * 1000),
      });

      await expect(
        service.login({
          email: 'admin@example.com',
          password: 'any-password',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Browser',
        })
      ).rejects.toThrow(AuthenticationError);

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGIN_BLOCKED_LOCKED',
          details: { reason: 'account_locked' },
        })
      );
    });

    it('ロック時間経過後はログイン可能', async () => {
      mockUserRepo.findByEmailWithPassword.mockResolvedValue({
        ...validUser,
        lockedUntil: new Date(Date.now() - 1000), // 1秒前（ロック解除済み）
        failedAttempts: 5,
      });
      mockBcrypt.compare.mockResolvedValue(true);
      mockSessionService.createSession.mockResolvedValue(mockSession);

      const result = await service.login({
        email: 'admin@example.com',
        password: 'correct-password',
      });

      expect(result.admin.id).toBe('admin-1');
      expect(mockUserRepo.resetFailedAttempts).toHaveBeenCalledWith('admin-1');
    });
  });

  describe('logout', () => {
    it('ログアウト処理を実行できる', async () => {
      mockSessionService.revokeSession.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      await service.logout('session-token', 'admin-1', '127.0.0.1', 'Test Browser');

      expect(mockSessionService.revokeSession).toHaveBeenCalledWith('session-token');
    });

    it('ログアウト時に監査ログを記録する（LOGOUT）', async () => {
      mockSessionService.revokeSession.mockResolvedValue(undefined);
      mockAuditLogService.log.mockResolvedValue(undefined);

      await service.logout('session-token', 'admin-1', '127.0.0.1', 'Test Browser');

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'LOGOUT',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Browser',
        })
      );
    });
  });

  describe('refreshSession', () => {
    it('セッション延長を実行できる', async () => {
      const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      mockSessionService.refreshSession.mockResolvedValue(newExpiresAt);
      mockAuditLogService.log.mockResolvedValue(undefined);

      const result = await service.refreshSession(
        'session-token',
        'admin-1',
        'session-1',
        new Date(),
        '127.0.0.1',
        'Test Browser'
      );

      expect(result).not.toBeNull();
      expect(mockSessionService.refreshSession).toHaveBeenCalledWith(
        'session-1',
        expect.any(Date)
      );
    });

    it('延長成功時に監査ログを記録する（SESSION_REFRESHED）', async () => {
      const newExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
      mockSessionService.refreshSession.mockResolvedValue(newExpiresAt);
      mockAuditLogService.log.mockResolvedValue(undefined);

      await service.refreshSession(
        'session-token',
        'admin-1',
        'session-1',
        new Date(),
        '127.0.0.1',
        'Test Browser'
      );

      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: 'admin-1',
          action: 'SESSION_REFRESHED',
          details: expect.objectContaining({
            newExpiresAt: expect.any(String),
          }),
        })
      );
    });

    it('延長不可の場合は監査ログを記録しない', async () => {
      mockSessionService.refreshSession.mockResolvedValue(null);

      const result = await service.refreshSession(
        'session-token',
        'admin-1',
        'session-1',
        new Date(Date.now() - 9 * 60 * 60 * 1000), // 9時間前（最大延長期限超過）
        '127.0.0.1',
        'Test Browser'
      );

      expect(result).toBeNull();
      expect(mockAuditLogService.log).not.toHaveBeenCalled();
    });
  });
});
