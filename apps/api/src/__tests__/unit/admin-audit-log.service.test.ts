import { describe, it, expect, vi, beforeEach } from 'vitest';

// prismaモック（vi.hoistedを使用）
const mockPrisma = vi.hoisted(() => ({
  adminAuditLog: {
    create: vi.fn(),
  },
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
  Prisma: {},
}));

// サービスのインポートはモック設定後
import { AdminAuditLogService } from '../../services/admin/admin-audit-log.service.js';

describe('AdminAuditLogService', () => {
  let service: AdminAuditLogService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminAuditLogService();
  });

  describe('log', () => {
    it('監査ログを記録できる', async () => {
      mockPrisma.adminAuditLog.create.mockResolvedValue({
        id: 'log-1',
        adminUserId: 'admin-1',
        action: 'LOGIN_SUCCESS',
      });

      await service.log({
        adminUserId: 'admin-1',
        action: 'LOGIN_SUCCESS',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      });

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          adminUserId: 'admin-1',
          action: 'LOGIN_SUCCESS',
          targetType: undefined,
          targetId: undefined,
          details: undefined,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Browser',
        },
      });
    });

    it('詳細情報を含めて記録できる', async () => {
      mockPrisma.adminAuditLog.create.mockResolvedValue({
        id: 'log-1',
        adminUserId: 'admin-1',
        action: 'LOGIN_FAILED',
      });

      await service.log({
        adminUserId: 'admin-1',
        action: 'LOGIN_FAILED',
        details: { reason: 'invalid_password', failedAttempts: 3 },
        targetType: 'session',
        targetId: 'session-1',
      });

      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith({
        data: {
          adminUserId: 'admin-1',
          action: 'LOGIN_FAILED',
          targetType: 'session',
          targetId: 'session-1',
          details: { reason: 'invalid_password', failedAttempts: 3 },
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('actionが空の場合は記録をスキップ', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await service.log({
        adminUserId: 'admin-1',
        action: '',
      });

      expect(mockPrisma.adminAuditLog.create).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '管理者監査ログ: actionが空のため記録をスキップ',
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });

    it('actionが空白のみの場合も記録をスキップ', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await service.log({
        adminUserId: 'admin-1',
        action: '   ',
      });

      expect(mockPrisma.adminAuditLog.create).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('DB書込みエラー時もメイン処理に影響しない', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPrisma.adminAuditLog.create.mockRejectedValue(new Error('DB connection error'));

      // エラーがスローされないことを確認
      await expect(
        service.log({
          adminUserId: 'admin-1',
          action: 'LOGIN_SUCCESS',
        })
      ).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalledWith(
        '管理者監査ログの記録に失敗:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('DB書込みエラー時もPromiseはresolveする', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockPrisma.adminAuditLog.create.mockRejectedValue(new Error('DB error'));

      // 明示的にPromiseの状態を確認
      const result = service.log({
        adminUserId: 'admin-1',
        action: 'LOGIN_SUCCESS',
      });

      await expect(result).resolves.not.toThrow();
    });
  });
});
