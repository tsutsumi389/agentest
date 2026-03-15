import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError } from '@agentest/shared';

// bcryptモック
const mockBcrypt = vi.hoisted(() => ({
  hash: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: (pwd: string, rounds: number) => mockBcrypt.hash(pwd, rounds),
  },
}));

// crypto モック
const mockCrypto = vi.hoisted(() => ({
  randomBytes: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: (size: number) => mockCrypto.randomBytes(size),
  },
}));

// hashToken モック
const mockHashToken = vi.hoisted(() => vi.fn());

vi.mock('../../utils/pkce.js', () => ({
  hashToken: mockHashToken,
}));

// Prisma モック
const mockPrisma = vi.hoisted(() => ({
  adminUser: {
    findFirst: vi.fn(),
  },
  adminPasswordResetToken: {
    updateMany: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  adminUser2: {
    update: vi.fn(),
  },
  adminSession: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    adminUser: mockPrisma.adminUser,
    adminPasswordResetToken: mockPrisma.adminPasswordResetToken,
    adminSession: mockPrisma.adminSession,
    $transaction: mockPrisma.$transaction,
  },
}));

// AdminAuditLogService モック
const mockAuditLogService = vi.hoisted(() => ({
  log: vi.fn(),
}));

vi.mock('../../services/admin/admin-audit-log.service.js', () => ({
  AdminAuditLogService: vi.fn().mockImplementation(() => mockAuditLogService),
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

// サービスのインポートはモック設定後
import { AdminPasswordResetService } from '../../services/admin/admin-password-reset.service.js';

describe('AdminPasswordResetService', () => {
  let service: AdminPasswordResetService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminPasswordResetService();

    // デフォルトの crypto.randomBytes モック
    mockCrypto.randomBytes.mockReturnValue({
      toString: () => 'raw-token-hex-string',
    });

    // デフォルトの hashToken モック
    mockHashToken.mockReturnValue('hashed-token');

    // デフォルトの $transaction モック: コールバックを実行
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<void>) => {
      await cb({
        adminPasswordResetToken: mockPrisma.adminPasswordResetToken,
        adminUser: mockPrisma.adminUser2,
        adminSession: mockPrisma.adminSession,
      });
    });
  });

  describe('requestPasswordReset', () => {
    const validAdmin = {
      id: 'admin-1',
      email: 'admin@example.com',
      name: 'Test Admin',
      deletedAt: null,
    };

    it('管理者が存在する場合、トークンを生成して返す', async () => {
      mockPrisma.adminUser.findFirst.mockResolvedValue(validAdmin);
      mockPrisma.adminPasswordResetToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.adminPasswordResetToken.create.mockResolvedValue({});

      const result = await service.requestPasswordReset('admin@example.com');

      expect(result).not.toBeNull();
      expect(result!.token).toBe('raw-token-hex-string');
      expect(result!.adminUser.id).toBe('admin-1');
      expect(result!.adminUser.name).toBe('Test Admin');
    });

    it('管理者が存在しない場合、nullを返す（メール列挙防止）', async () => {
      mockPrisma.adminUser.findFirst.mockResolvedValue(null);

      const result = await service.requestPasswordReset('nonexistent@example.com');

      expect(result).toBeNull();
      // トランザクションは実行されない
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('既存の未使用トークンを無効化してから新しいトークンを作成する', async () => {
      mockPrisma.adminUser.findFirst.mockResolvedValue(validAdmin);
      mockPrisma.adminPasswordResetToken.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.adminPasswordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('admin@example.com');

      // updateMany が先に呼ばれ、その後 create が呼ばれる
      expect(mockPrisma.adminPasswordResetToken.updateMany).toHaveBeenCalledWith({
        where: { adminUserId: 'admin-1', usedAt: null },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockPrisma.adminPasswordResetToken.create).toHaveBeenCalledWith({
        data: {
          adminUserId: 'admin-1',
          tokenHash: 'hashed-token',
          expiresAt: expect.any(Date),
        },
      });
    });

    it('トークンの有効期限が1時間後に設定される', async () => {
      mockPrisma.adminUser.findFirst.mockResolvedValue(validAdmin);
      mockPrisma.adminPasswordResetToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.adminPasswordResetToken.create.mockResolvedValue({});

      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      await service.requestPasswordReset('admin@example.com');

      const createCall = mockPrisma.adminPasswordResetToken.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      expect(expiresAt).toBe(now + 60 * 60 * 1000);

      vi.restoreAllMocks();
    });

    it('監査ログを記録する', async () => {
      mockPrisma.adminUser.findFirst.mockResolvedValue(validAdmin);
      mockPrisma.adminPasswordResetToken.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.adminPasswordResetToken.create.mockResolvedValue({});

      await service.requestPasswordReset('admin@example.com');

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: 'admin-1',
        action: 'PASSWORD_RESET_REQUESTED',
        targetType: 'AdminUser',
        targetId: 'admin-1',
      });
    });

    it('削除済み管理者の場合、nullを返す', async () => {
      mockPrisma.adminUser.findFirst.mockResolvedValue(null); // deletedAt条件で除外される

      const result = await service.requestPasswordReset('deleted@example.com');

      expect(result).toBeNull();
    });
  });

  describe('resetPassword', () => {
    const validResetToken = {
      id: 'token-1',
      adminUserId: 'admin-1',
      tokenHash: 'hashed-token',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1時間後
      usedAt: null,
      adminUser: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Test Admin',
      },
    };

    it('有効なトークンでパスワードをリセットできる', async () => {
      mockPrisma.adminPasswordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      mockPrisma.adminPasswordResetToken.update.mockResolvedValue({});
      mockPrisma.adminUser2.update.mockResolvedValue({});
      mockPrisma.adminSession.updateMany.mockResolvedValue({ count: 2 });

      await expect(service.resetPassword('raw-token', 'NewPassword123!')).resolves.not.toThrow();

      // bcryptでパスワードハッシュ化（12 rounds）
      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
    });

    it('トークンが存在しない場合、BadRequestErrorを投げる', async () => {
      mockPrisma.adminPasswordResetToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('invalid-token', 'NewPassword123!')).rejects.toThrow(
        BadRequestError
      );
      await expect(service.resetPassword('invalid-token', 'NewPassword123!')).rejects.toThrow(
        '無効なパスワードリセットトークンです'
      );
    });

    it('使用済みトークンの場合、BadRequestErrorを投げる', async () => {
      const usedToken = { ...validResetToken, usedAt: new Date() };
      mockPrisma.adminPasswordResetToken.findFirst.mockResolvedValue(usedToken);

      await expect(service.resetPassword('used-token', 'NewPassword123!')).rejects.toThrow(
        'このパスワードリセットトークンは既に使用されています'
      );
    });

    it('期限切れトークンの場合、BadRequestErrorを投げる', async () => {
      const expiredToken = {
        ...validResetToken,
        expiresAt: new Date(Date.now() - 1000), // 1秒前に期限切れ
      };
      mockPrisma.adminPasswordResetToken.findFirst.mockResolvedValue(expiredToken);

      await expect(service.resetPassword('expired-token', 'NewPassword123!')).rejects.toThrow(
        'パスワードリセットトークンの有効期限が切れています'
      );
    });

    it('トランザクション内でトークン使用済み化、パスワード更新、セッション無効化を実行する', async () => {
      mockPrisma.adminPasswordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      mockPrisma.adminPasswordResetToken.update.mockResolvedValue({});
      mockPrisma.adminUser2.update.mockResolvedValue({});
      mockPrisma.adminSession.updateMany.mockResolvedValue({ count: 0 });

      await service.resetPassword('raw-token', 'NewPassword123!');

      // トランザクションが呼ばれた
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // トークンを使用済みにする
      expect(mockPrisma.adminPasswordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'token-1' },
        data: { usedAt: expect.any(Date) },
      });

      // パスワード更新 + ロック解除 + 失敗回数リセット
      expect(mockPrisma.adminUser2.update).toHaveBeenCalledWith({
        where: { id: 'admin-1' },
        data: {
          passwordHash: 'new-hashed-password',
          failedAttempts: 0,
          lockedUntil: null,
        },
      });

      // 全セッション無効化
      expect(mockPrisma.adminSession.updateMany).toHaveBeenCalledWith({
        where: {
          adminUserId: 'admin-1',
          revokedAt: null,
        },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('リセット完了後に監査ログを記録する', async () => {
      mockPrisma.adminPasswordResetToken.findFirst.mockResolvedValue(validResetToken);
      mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      mockPrisma.adminPasswordResetToken.update.mockResolvedValue({});
      mockPrisma.adminUser2.update.mockResolvedValue({});
      mockPrisma.adminSession.updateMany.mockResolvedValue({ count: 0 });

      await service.resetPassword('raw-token', 'NewPassword123!');

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        adminUserId: 'admin-1',
        action: 'PASSWORD_RESET_COMPLETED',
        targetType: 'AdminUser',
        targetId: 'admin-1',
      });
    });

    it('hashTokenを使ってトークンをSHA-256ハッシュ化してからDB検索する', async () => {
      mockPrisma.adminPasswordResetToken.findFirst.mockResolvedValue(null);

      try {
        await service.resetPassword('raw-token', 'NewPassword123!');
      } catch {
        // エラーは無視
      }

      expect(mockHashToken).toHaveBeenCalledWith('raw-token');
      expect(mockPrisma.adminPasswordResetToken.findFirst).toHaveBeenCalledWith({
        where: { tokenHash: 'hashed-token' },
        include: { adminUser: true },
      });
    });
  });
});
