import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@agentest/db';
import { SystemAdminService } from '../../services/admin/system-admin.service.js';
import { BusinessError, NotFoundError } from '@agentest/shared';

// Prismaモック
vi.mock('@agentest/db', () => ({
  prisma: {
    adminUser: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    adminSession: {
      updateMany: vi.fn(),
    },
    adminAuditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callbacks) => Promise.all(callbacks)),
  },
  AdminRoleType: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    VIEWER: 'VIEWER',
  },
}));

// Redisキャッシュモック
vi.mock('../../lib/redis-store', () => ({
  getSystemAdminsCache: vi.fn().mockResolvedValue(null),
  setSystemAdminsCache: vi.fn().mockResolvedValue(true),
  getSystemAdminDetailCache: vi.fn().mockResolvedValue(null),
  setSystemAdminDetailCache: vi.fn().mockResolvedValue(true),
  invalidateSystemAdminsCache: vi.fn().mockResolvedValue(true),
  invalidateSystemAdminDetailCache: vi.fn().mockResolvedValue(true),
}));

describe('SystemAdminService', () => {
  let service: SystemAdminService;

  beforeEach(() => {
    service = new SystemAdminService();
    vi.clearAllMocks();
  });

  describe('findAdminUsers', () => {
    it('管理者一覧を取得できる', async () => {
      const mockAdmins = [
        {
          id: 'admin-1',
          email: 'admin1@example.com',
          name: 'Admin 1',
          role: 'SUPER_ADMIN',
          totpEnabled: true,
          failedAttempts: 0,
          lockedUntil: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          sessions: [{ lastActiveAt: new Date() }],
          _count: { sessions: 1 },
        },
      ];

      vi.mocked(prisma.adminUser.findMany).mockResolvedValue(mockAdmins as never);
      vi.mocked(prisma.adminUser.count).mockResolvedValue(1);

      const result = await service.findAdminUsers({});

      expect(result.adminUsers).toHaveLength(1);
      expect(result.adminUsers[0].id).toBe('admin-1');
      expect(result.pagination.total).toBe(1);
    });

    it('ステータスフィルタが正しく動作する', async () => {
      vi.mocked(prisma.adminUser.findMany).mockResolvedValue([]);
      vi.mocked(prisma.adminUser.count).mockResolvedValue(0);

      await service.findAdminUsers({ status: 'deleted' });

      expect(prisma.adminUser.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: { not: null },
          }),
        })
      );
    });
  });

  describe('deleteAdminUser', () => {
    it('自分自身を削除しようとするとエラーになる', async () => {
      const adminId = 'admin-1';

      await expect(service.deleteAdminUser(adminId, adminId)).rejects.toThrow(
        BusinessError
      );
      await expect(service.deleteAdminUser(adminId, adminId)).rejects.toThrow(
        '自分自身は削除できません'
      );
    });

    it('存在しない管理者を削除しようとするとエラーになる', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

      await expect(
        service.deleteAdminUser('non-existent', 'current-admin')
      ).rejects.toThrow(NotFoundError);
    });

    it('最後のSUPER_ADMINを削除しようとするとエラーになる', async () => {
      const targetAdmin = {
        id: 'super-admin-1',
        role: 'SUPER_ADMIN',
        deletedAt: null,
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(targetAdmin as never);
      vi.mocked(prisma.adminUser.count).mockResolvedValue(1);

      await expect(
        service.deleteAdminUser('super-admin-1', 'current-admin')
      ).rejects.toThrow(BusinessError);
      await expect(
        service.deleteAdminUser('super-admin-1', 'current-admin')
      ).rejects.toThrow('最後のSUPER_ADMINは削除できません');
    });

    it('削除済み管理者を削除しようとするとエラーになる', async () => {
      const deletedAdmin = {
        id: 'deleted-admin',
        role: 'ADMIN',
        deletedAt: new Date(),
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(deletedAdmin as never);

      await expect(
        service.deleteAdminUser('deleted-admin', 'current-admin')
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updateAdminUser', () => {
    it('自分自身のロールを変更しようとするとエラーになる', async () => {
      const adminId = 'admin-1';
      const targetAdmin = {
        id: adminId,
        name: 'Admin',
        role: 'ADMIN',
        deletedAt: null,
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(targetAdmin as never);

      await expect(
        service.updateAdminUser(adminId, { role: 'VIEWER' }, adminId)
      ).rejects.toThrow(BusinessError);
      await expect(
        service.updateAdminUser(adminId, { role: 'VIEWER' }, adminId)
      ).rejects.toThrow('自分自身のロールは変更できません');
    });

    it('最後のSUPER_ADMINのロールを変更しようとするとエラーになる', async () => {
      const superAdmin = {
        id: 'super-admin-1',
        name: 'Super Admin',
        role: 'SUPER_ADMIN',
        deletedAt: null,
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(superAdmin as never);
      vi.mocked(prisma.adminUser.count).mockResolvedValue(1);

      await expect(
        service.updateAdminUser('super-admin-1', { role: 'ADMIN' }, 'current-admin')
      ).rejects.toThrow(BusinessError);
      await expect(
        service.updateAdminUser('super-admin-1', { role: 'ADMIN' }, 'current-admin')
      ).rejects.toThrow('最後のSUPER_ADMINのロールは変更できません');
    });

    it('名前だけ変更する場合は正常に動作する', async () => {
      const targetAdmin = {
        id: 'admin-1',
        name: 'Old Name',
        role: 'ADMIN',
        deletedAt: null,
      };
      const updatedAdmin = {
        ...targetAdmin,
        name: 'New Name',
        email: 'admin@example.com',
        totpEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(targetAdmin as never);
      vi.mocked(prisma.adminUser.update).mockResolvedValue(updatedAdmin as never);
      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never);

      const result = await service.updateAdminUser(
        'admin-1',
        { name: 'New Name' },
        'current-admin'
      );

      expect(result.adminUser.name).toBe('New Name');
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'New Name' },
        })
      );
    });
  });

  describe('inviteAdminUser', () => {
    it('新しい管理者を招待できる', async () => {
      const newAdmin = {
        id: 'new-admin',
        email: 'new@example.com',
        name: 'New Admin',
        role: 'ADMIN',
        totpEnabled: false,
        createdAt: new Date(),
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.adminUser.create).mockResolvedValue(newAdmin as never);
      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never);

      const result = await service.inviteAdminUser(
        { email: 'new@example.com', name: 'New Admin', role: 'ADMIN' },
        'current-admin'
      );

      expect(result.adminUser.email).toBe('new@example.com');
      expect(result.adminUser.role).toBe('ADMIN');
    });

    it('既に登録されているメールアドレスの場合はエラーになる', async () => {
      const existingAdmin = {
        id: 'existing-admin',
        deletedAt: null,
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(existingAdmin as never);

      await expect(
        service.inviteAdminUser(
          { email: 'existing@example.com', name: 'Existing', role: 'ADMIN' },
          'current-admin'
        )
      ).rejects.toThrow(BusinessError);
      await expect(
        service.inviteAdminUser(
          { email: 'existing@example.com', name: 'Existing', role: 'ADMIN' },
          'current-admin'
        )
      ).rejects.toThrow('このメールアドレスは既に登録されています');
    });
  });

  describe('unlockAdminUser', () => {
    it('ロックされたアカウントを解除できる', async () => {
      const lockedAdmin = {
        id: 'locked-admin',
        lockedUntil: new Date(Date.now() + 3600000),
        deletedAt: null,
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(lockedAdmin as never);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as never);
      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never);

      const result = await service.unlockAdminUser('locked-admin', 'current-admin');

      expect(result.message).toBe('アカウントロックを解除しました');
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { lockedUntil: null, failedAttempts: 0 },
        })
      );
    });
  });

  describe('reset2FA', () => {
    it('2FAをリセットできる', async () => {
      const admin = {
        id: 'admin-1',
        totpEnabled: true,
        deletedAt: null,
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(admin as never);
      vi.mocked(prisma.adminUser.update).mockResolvedValue({} as never);
      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never);

      const result = await service.reset2FA('admin-1', 'current-admin');

      expect(result.message).toBe('2FA設定をリセットしました');
      expect(prisma.adminUser.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totpEnabled: false, totpSecret: null },
        })
      );
    });
  });
});
