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
    adminInvitation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((callbacks) => Promise.all(callbacks)),
  },
  AdminRoleType: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    VIEWER: 'VIEWER',
  },
}));

// メールサービスモック
vi.mock('../../services/email.service', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(undefined),
    generateAdminInvitationEmail: vi.fn().mockReturnValue({
      subject: 'Test Subject',
      text: 'Test Text',
      html: '<p>Test HTML</p>',
    }),
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

      await expect(service.deleteAdminUser(adminId, adminId)).rejects.toThrow(BusinessError);
      await expect(service.deleteAdminUser(adminId, adminId)).rejects.toThrow(
        '自分自身は削除できません'
      );
    });

    it('存在しない管理者を削除しようとするとエラーになる', async () => {
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);

      await expect(service.deleteAdminUser('non-existent', 'current-admin')).rejects.toThrow(
        NotFoundError
      );
    });

    it('最後のSUPER_ADMINを削除しようとするとエラーになる', async () => {
      const targetAdmin = {
        id: 'super-admin-1',
        role: 'SUPER_ADMIN',
        deletedAt: null,
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(targetAdmin as never);
      vi.mocked(prisma.adminUser.count).mockResolvedValue(1);

      await expect(service.deleteAdminUser('super-admin-1', 'current-admin')).rejects.toThrow(
        BusinessError
      );
      await expect(service.deleteAdminUser('super-admin-1', 'current-admin')).rejects.toThrow(
        '最後のSUPER_ADMINは削除できません'
      );
    });

    it('削除済み管理者を削除しようとするとエラーになる', async () => {
      const deletedAdmin = {
        id: 'deleted-admin',
        role: 'ADMIN',
        deletedAt: new Date(),
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(deletedAdmin as never);

      await expect(service.deleteAdminUser('deleted-admin', 'current-admin')).rejects.toThrow(
        NotFoundError
      );
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

      await expect(service.updateAdminUser(adminId, { role: 'VIEWER' }, adminId)).rejects.toThrow(
        BusinessError
      );
      await expect(service.updateAdminUser(adminId, { role: 'VIEWER' }, adminId)).rejects.toThrow(
        '自分自身のロールは変更できません'
      );
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
      const invitation = {
        id: 'invitation-1',
        email: 'new@example.com',
        name: 'New Admin',
        role: 'ADMIN',
        token: 'test-token',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      const inviter = { name: 'Current Admin' };

      vi.mocked(prisma.adminUser.findUnique)
        .mockResolvedValueOnce(null) // アクティブユーザーチェック
        .mockResolvedValueOnce(inviter as never); // 招待者情報取得
      vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.adminInvitation.create).mockResolvedValue(invitation as never);
      vi.mocked(prisma.adminAuditLog.create).mockResolvedValue({} as never);

      const result = await service.inviteAdminUser(
        { email: 'new@example.com', name: 'New Admin', role: 'ADMIN' },
        'current-admin'
      );

      expect(result.adminUser.email).toBe('new@example.com');
      expect(result.adminUser.role).toBe('ADMIN');
      expect(result.invitationSent).toBe(true);
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

    it('有効な招待が既に存在する場合はエラーになる', async () => {
      const existingInvitation = {
        id: 'invitation-1',
        email: 'invited@example.com',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.adminInvitation.findFirst).mockResolvedValue(existingInvitation as never);

      await expect(
        service.inviteAdminUser(
          { email: 'invited@example.com', name: 'Invited', role: 'ADMIN' },
          'current-admin'
        )
      ).rejects.toThrow(BusinessError);
      await expect(
        service.inviteAdminUser(
          { email: 'invited@example.com', name: 'Invited', role: 'ADMIN' },
          'current-admin'
        )
      ).rejects.toThrow('有効な招待が既に存在します');
    });
  });

  describe('getInvitation', () => {
    it('有効な招待情報を取得できる', async () => {
      const invitation = {
        id: 'invitation-1',
        email: 'invited@example.com',
        name: 'Invited User',
        role: 'ADMIN',
        token: 'valid-token',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        invitedBy: { name: 'Inviter' },
      };

      vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(invitation as never);

      const result = await service.getInvitation('valid-token');

      expect(result.email).toBe('invited@example.com');
      expect(result.name).toBe('Invited User');
      expect(result.role).toBe('ADMIN');
      expect(result.invitedBy).toBe('Inviter');
    });

    it('存在しないトークンの場合はエラーになる', async () => {
      vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(null);

      await expect(service.getInvitation('invalid-token')).rejects.toThrow(NotFoundError);
    });

    it('既に受諾済みの招待はエラーになる', async () => {
      const acceptedInvitation = {
        id: 'invitation-1',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        invitedBy: { name: 'Inviter' },
      };

      vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(acceptedInvitation as never);

      await expect(service.getInvitation('used-token')).rejects.toThrow(BusinessError);
      await expect(service.getInvitation('used-token')).rejects.toThrow(
        'この招待は既に受諾されています'
      );
    });

    it('期限切れの招待はエラーになる', async () => {
      const expiredInvitation = {
        id: 'invitation-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000), // 過去の日時
        invitedBy: { name: 'Inviter' },
      };

      vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(expiredInvitation as never);

      await expect(service.getInvitation('expired-token')).rejects.toThrow(BusinessError);
      await expect(service.getInvitation('expired-token')).rejects.toThrow(
        'この招待は有効期限が切れています'
      );
    });
  });

  describe('acceptInvitation', () => {
    it('招待を受諾してアカウントを作成できる', async () => {
      const invitation = {
        id: 'invitation-1',
        email: 'invited@example.com',
        name: 'Invited User',
        role: 'ADMIN',
        acceptedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      const newAdmin = {
        id: 'new-admin-1',
        email: 'invited@example.com',
        name: 'Invited User',
        role: 'ADMIN',
      };

      vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(invitation as never);
      vi.mocked(prisma.adminUser.findUnique).mockResolvedValue(null); // 既存ユーザーなし
      vi.mocked(prisma.adminUser.create).mockResolvedValue(newAdmin as never);
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}] as never);

      const result = await service.acceptInvitation('valid-token', 'StrongPassword123!');

      expect(result.adminUser.email).toBe('invited@example.com');
      expect(result.adminUser.name).toBe('Invited User');
      expect(result.message).toContain('有効化');
    });

    it('期限切れのトークンではエラーになる', async () => {
      const expiredInvitation = {
        id: 'invitation-1',
        acceptedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      };

      vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(expiredInvitation as never);

      await expect(service.acceptInvitation('expired-token', 'StrongPassword123!')).rejects.toThrow(
        BusinessError
      );
      await expect(service.acceptInvitation('expired-token', 'StrongPassword123!')).rejects.toThrow(
        'この招待は有効期限が切れています'
      );
    });

    it('既に使用済みのトークンではエラーになる', async () => {
      const usedInvitation = {
        id: 'invitation-1',
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };

      vi.mocked(prisma.adminInvitation.findUnique).mockResolvedValue(usedInvitation as never);

      await expect(service.acceptInvitation('used-token', 'StrongPassword123!')).rejects.toThrow(
        BusinessError
      );
      await expect(service.acceptInvitation('used-token', 'StrongPassword123!')).rejects.toThrow(
        'この招待は既に受諾されています'
      );
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
