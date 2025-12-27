import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ConflictError, AuthorizationError } from '@agentest/shared';

// OrganizationRepository のモック
const mockOrgRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findBySlug: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  findDeletedById: vi.fn(),
  restore: vi.fn(),
}));

vi.mock('../../repositories/organization.repository.js', () => ({
  OrganizationRepository: vi.fn().mockImplementation(() => mockOrgRepo),
}));

// AuditLogService のモック
const mockAuditLogService = vi.hoisted(() => ({
  log: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/audit-log.service.js', () => ({
  auditLogService: mockAuditLogService,
}));

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  organizationMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  organizationInvitation: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((fn) => fn(mockPrisma)),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { OrganizationService } from '../../services/organization.service.js';

describe('OrganizationService', () => {
  let service: OrganizationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrganizationService();
  });

  describe('getInvitationByToken', () => {
    const mockInvitation = {
      id: 'inv-1',
      organizationId: 'org-1',
      email: 'user@example.com',
      role: 'MEMBER',
      token: 'token-1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      acceptedAt: null,
      declinedAt: null,
      organization: {
        id: 'org-1',
        name: 'Test Org',
        slug: 'test-org',
        avatarUrl: null,
      },
      invitedBy: {
        id: 'inviter-1',
        email: 'admin@example.com',
        name: 'Admin',
        avatarUrl: null,
      },
    };

    it('トークンで招待詳細を取得できる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);

      const result = await service.getInvitationByToken('token-1');

      expect(mockPrisma.organizationInvitation.findUnique).toHaveBeenCalledWith({
        where: { token: 'token-1' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatarUrl: true,
            },
          },
          invitedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });
      expect(result.id).toBe('inv-1');
      expect(result.email).toBe('user@example.com');
      expect(result.status).toBe('pending');
      expect(result.organization.name).toBe('Test Org');
      expect(result.invitedBy.name).toBe('Admin');
    });

    it('招待が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(null);

      await expect(service.getInvitationByToken('invalid-token'))
        .rejects.toThrow(NotFoundError);
    });

    it('承諾済みの招待はstatus=acceptedを返す', async () => {
      const acceptedInvitation = {
        ...mockInvitation,
        acceptedAt: new Date(),
      };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(acceptedInvitation);

      const result = await service.getInvitationByToken('token-1');

      expect(result.status).toBe('accepted');
    });

    it('辞退済みの招待はstatus=declinedを返す', async () => {
      const declinedInvitation = {
        ...mockInvitation,
        declinedAt: new Date(),
      };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(declinedInvitation);

      const result = await service.getInvitationByToken('token-1');

      expect(result.status).toBe('declined');
    });

    it('期限切れの招待はstatus=expiredを返す', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(expiredInvitation);

      const result = await service.getInvitationByToken('token-1');

      expect(result.status).toBe('expired');
    });

    it('承諾済みかつ期限切れの場合はacceptedを優先する', async () => {
      const acceptedExpiredInvitation = {
        ...mockInvitation,
        acceptedAt: new Date(),
        expiresAt: new Date(Date.now() - 1000),
      };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(acceptedExpiredInvitation);

      const result = await service.getInvitationByToken('token-1');

      expect(result.status).toBe('accepted');
    });
  });

  describe('getPendingInvitations', () => {
    const mockInvitations = [
      {
        id: 'inv-1',
        organizationId: 'org-1',
        email: 'user1@example.com',
        role: 'MEMBER',
        token: 'token-1',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        declinedAt: null,
        createdAt: new Date(),
        invitedBy: {
          id: 'inviter-1',
          email: 'admin@example.com',
          name: 'Admin',
          avatarUrl: null,
        },
      },
      {
        id: 'inv-2',
        organizationId: 'org-1',
        email: 'user2@example.com',
        role: 'ADMIN',
        token: 'token-2',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        declinedAt: null,
        createdAt: new Date(),
        invitedBy: {
          id: 'inviter-1',
          email: 'admin@example.com',
          name: 'Admin',
          avatarUrl: null,
        },
      },
    ];

    it('保留中の招待一覧を取得できる', async () => {
      mockOrgRepo.findById.mockResolvedValue({ id: 'org-1', name: 'Test Org' });
      mockPrisma.organizationInvitation.findMany.mockResolvedValue(mockInvitations);

      const result = await service.getPendingInvitations('org-1');

      expect(mockOrgRepo.findById).toHaveBeenCalledWith('org-1');
      expect(mockPrisma.organizationInvitation.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: 'org-1',
          acceptedAt: null,
          declinedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        include: {
          invitedBy: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(2);
    });

    it('組織が存在しない場合はNotFoundErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(null);

      await expect(service.getPendingInvitations('invalid-org'))
        .rejects.toThrow(NotFoundError);
    });

    it('保留中の招待がない場合は空配列を返す', async () => {
      mockOrgRepo.findById.mockResolvedValue({ id: 'org-1', name: 'Test Org' });
      mockPrisma.organizationInvitation.findMany.mockResolvedValue([]);

      const result = await service.getPendingInvitations('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('cancelInvitation', () => {
    const mockInvitation = {
      id: 'inv-1',
      organizationId: 'org-1',
      email: 'user@example.com',
      role: 'MEMBER',
      token: 'token-1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
      declinedAt: null,
    };

    it('招待を取消できる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.organizationInvitation.delete.mockResolvedValue(mockInvitation);

      await service.cancelInvitation('org-1', 'inv-1');

      expect(mockPrisma.organizationInvitation.findUnique).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
      });
      expect(mockPrisma.organizationInvitation.delete).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
      });
    });

    it('招待が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(null);

      await expect(service.cancelInvitation('org-1', 'invalid-inv'))
        .rejects.toThrow(NotFoundError);
    });

    it('異なる組織の招待を取消そうとするとAuthorizationErrorを投げる', async () => {
      const otherOrgInvitation = { ...mockInvitation, organizationId: 'org-2' };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(otherOrgInvitation);

      await expect(service.cancelInvitation('org-1', 'inv-1'))
        .rejects.toThrow(AuthorizationError);
    });

    it('既に承諾された招待を取消そうとするとConflictErrorを投げる', async () => {
      const acceptedInvitation = { ...mockInvitation, acceptedAt: new Date() };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(acceptedInvitation);

      await expect(service.cancelInvitation('org-1', 'inv-1'))
        .rejects.toThrow(ConflictError);
    });

    it('既に辞退された招待を取消そうとするとConflictErrorを投げる', async () => {
      const declinedInvitation = { ...mockInvitation, declinedAt: new Date() };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(declinedInvitation);

      await expect(service.cancelInvitation('org-1', 'inv-1'))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('declineInvitation', () => {
    const mockUser = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    };

    const mockInvitation = {
      id: 'inv-1',
      organizationId: 'org-1',
      email: 'user@example.com',
      role: 'MEMBER',
      token: 'token-1',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
      declinedAt: null,
      organization: { id: 'org-1', name: 'Test Org' },
    };

    it('招待を辞退できる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.organizationInvitation.update.mockResolvedValue({
        ...mockInvitation,
        declinedAt: new Date(),
      });

      const result = await service.declineInvitation('token-1', 'user-1');

      expect(mockPrisma.organizationInvitation.findUnique).toHaveBeenCalledWith({
        where: { token: 'token-1' },
        include: { organization: true },
      });
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      expect(mockPrisma.organizationInvitation.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: { declinedAt: expect.any(Date) },
        include: { organization: true },
      });
      expect(result.declinedAt).toBeDefined();
    });

    it('招待が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(null);

      await expect(service.declineInvitation('invalid-token', 'user-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('既に承諾された招待を辞退しようとするとConflictErrorを投げる', async () => {
      const acceptedInvitation = { ...mockInvitation, acceptedAt: new Date() };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(acceptedInvitation);

      await expect(service.declineInvitation('token-1', 'user-1'))
        .rejects.toThrow(ConflictError);
    });

    it('既に辞退された招待を辞退しようとするとConflictErrorを投げる', async () => {
      const declinedInvitation = { ...mockInvitation, declinedAt: new Date() };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(declinedInvitation);

      await expect(service.declineInvitation('token-1', 'user-1'))
        .rejects.toThrow(ConflictError);
    });

    it('期限切れの招待を辞退しようとするとConflictErrorを投げる', async () => {
      const expiredInvitation = {
        ...mockInvitation,
        expiresAt: new Date(Date.now() - 1000), // 過去の日時
      };
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(expiredInvitation);

      await expect(service.declineInvitation('token-1', 'user-1'))
        .rejects.toThrow(ConflictError);
    });

    it('他人宛ての招待を辞退しようとするとAuthorizationErrorを投げる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        email: 'other@example.com', // 異なるメールアドレス
      });

      await expect(service.declineInvitation('token-1', 'user-1'))
        .rejects.toThrow(AuthorizationError);
    });

    it('ユーザーが存在しない場合はAuthorizationErrorを投げる', async () => {
      mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.declineInvitation('token-1', 'user-1'))
        .rejects.toThrow(AuthorizationError);
    });
  });

  describe('invite', () => {
    const mockOrg = { id: 'org-1', name: 'Test Org' };

    it('新しいメールアドレスに招待を送信できる', async () => {
      mockOrgRepo.findById.mockResolvedValue(mockOrg);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organizationInvitation.findFirst.mockResolvedValue(null);
      mockPrisma.organizationInvitation.create.mockResolvedValue({
        id: 'inv-1',
        organizationId: 'org-1',
        email: 'newuser@example.com',
        role: 'MEMBER',
        token: expect.any(String),
        expiresAt: expect.any(Date),
      });

      const result = await service.invite('org-1', 'inviter-1', {
        email: 'newuser@example.com',
        role: 'MEMBER',
      });

      expect(mockPrisma.organizationInvitation.create).toHaveBeenCalled();
      expect(result.email).toBe('newuser@example.com');
    });

    it('既にメンバーのユーザーを招待しようとするとConflictErrorを投げる', async () => {
      const existingUser = { id: 'user-1', email: 'existing@example.com' };
      mockOrgRepo.findById.mockResolvedValue(mockOrg);
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.organizationMember.findUnique.mockResolvedValue({
        organizationId: 'org-1',
        userId: 'user-1',
        role: 'MEMBER',
      });

      await expect(service.invite('org-1', 'inviter-1', {
        email: 'existing@example.com',
        role: 'MEMBER',
      })).rejects.toThrow(ConflictError);
    });

    it('保留中の招待がある場合はConflictErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(mockOrg);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.organizationInvitation.findFirst.mockResolvedValue({
        id: 'inv-1',
        email: 'pending@example.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        acceptedAt: null,
        declinedAt: null,
      });

      await expect(service.invite('org-1', 'inviter-1', {
        email: 'pending@example.com',
        role: 'MEMBER',
      })).rejects.toThrow(ConflictError);
    });

    it('組織が存在しない場合はNotFoundErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(null);

      await expect(service.invite('invalid-org', 'inviter-1', {
        email: 'user@example.com',
        role: 'MEMBER',
      })).rejects.toThrow(NotFoundError);
    });
  });

  describe('transferOwnership', () => {
    const mockOrg = { id: 'org-1', name: 'Test Org' };
    const mockCurrentOwner = {
      organizationId: 'org-1',
      userId: 'owner-1',
      role: 'OWNER',
    };
    const mockNewOwner = {
      organizationId: 'org-1',
      userId: 'admin-1',
      role: 'ADMIN',
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        name: 'Admin User',
        avatarUrl: null,
      },
    };

    it('オーナー権限を移譲できる', async () => {
      mockOrgRepo.findById.mockResolvedValue(mockOrg);
      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce(mockCurrentOwner) // 現オーナー確認
        .mockResolvedValueOnce(mockNewOwner); // 新オーナー確認
      mockPrisma.organizationMember.update.mockResolvedValue({
        ...mockNewOwner,
        role: 'OWNER',
      });

      const result = await service.transferOwnership('org-1', 'owner-1', 'admin-1');

      expect(mockOrgRepo.findById).toHaveBeenCalledWith('org-1');
      expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledTimes(2);
      expect(mockPrisma.organizationMember.update).toHaveBeenCalledTimes(2);
      // 現オーナー→ADMIN
      expect(mockPrisma.organizationMember.update).toHaveBeenNthCalledWith(1, {
        where: {
          organizationId_userId: { organizationId: 'org-1', userId: 'owner-1' },
        },
        data: { role: 'ADMIN' },
      });
      // 新オーナー→OWNER
      expect(mockPrisma.organizationMember.update).toHaveBeenNthCalledWith(2, {
        where: {
          organizationId_userId: { organizationId: 'org-1', userId: 'admin-1' },
        },
        data: { role: 'OWNER' },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
      expect(result.role).toBe('OWNER');
    });

    it('組織が存在しない場合はNotFoundErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(null);

      await expect(service.transferOwnership('invalid-org', 'owner-1', 'admin-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('自分自身への移譲はConflictErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(mockOrg);

      await expect(service.transferOwnership('org-1', 'owner-1', 'owner-1'))
        .rejects.toThrow(ConflictError);
    });

    it('非オーナーからの移譲はAuthorizationErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(mockOrg);
      mockPrisma.organizationMember.findUnique.mockResolvedValueOnce({
        ...mockCurrentOwner,
        role: 'ADMIN', // オーナーではない
      });

      await expect(service.transferOwnership('org-1', 'admin-1', 'member-1'))
        .rejects.toThrow(AuthorizationError);
    });

    it('現オーナーがメンバーでない場合はAuthorizationErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(mockOrg);
      mockPrisma.organizationMember.findUnique.mockResolvedValueOnce(null);

      await expect(service.transferOwnership('org-1', 'non-member', 'admin-1'))
        .rejects.toThrow(AuthorizationError);
    });

    it('新オーナーがメンバーでない場合はNotFoundErrorを投げる', async () => {
      mockOrgRepo.findById.mockResolvedValue(mockOrg);
      mockPrisma.organizationMember.findUnique
        .mockResolvedValueOnce(mockCurrentOwner) // 現オーナー確認
        .mockResolvedValueOnce(null); // 新オーナーが存在しない

      await expect(service.transferOwnership('org-1', 'owner-1', 'non-member'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('updateMemberRole', () => {
    const mockMember = {
      organizationId: 'org-1',
      userId: 'member-1',
      role: 'MEMBER',
      user: {
        id: 'member-1',
        email: 'member@example.com',
        name: 'Member User',
        avatarUrl: null,
      },
    };

    it('メンバーのロールをADMINに変更できる', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMember);
      mockPrisma.organizationMember.update.mockResolvedValue({
        ...mockMember,
        role: 'ADMIN',
      });

      const result = await service.updateMemberRole('org-1', 'member-1', 'ADMIN');

      expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: 'org-1', userId: 'member-1' },
        },
      });
      expect(mockPrisma.organizationMember.update).toHaveBeenCalledWith({
        where: {
          organizationId_userId: { organizationId: 'org-1', userId: 'member-1' },
        },
        data: { role: 'ADMIN' },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
      expect(result.role).toBe('ADMIN');
    });

    it('ADMINのロールをMEMBERに変更できる', async () => {
      const mockAdmin = { ...mockMember, role: 'ADMIN' };
      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockAdmin);
      mockPrisma.organizationMember.update.mockResolvedValue({
        ...mockAdmin,
        role: 'MEMBER',
      });

      const result = await service.updateMemberRole('org-1', 'member-1', 'MEMBER');

      expect(result.role).toBe('MEMBER');
    });

    it('メンバーが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(service.updateMemberRole('org-1', 'invalid-user', 'ADMIN'))
        .rejects.toThrow(NotFoundError);
    });

    it('OWNERのロール変更はConflictErrorを投げる', async () => {
      const mockOwner = { ...mockMember, role: 'OWNER' };
      mockPrisma.organizationMember.findUnique.mockResolvedValue(mockOwner);

      await expect(service.updateMemberRole('org-1', 'owner-1', 'ADMIN'))
        .rejects.toThrow(ConflictError);
    });
  });

  describe('restore', () => {
    const mockDeletedOrg = {
      id: 'org-1',
      name: 'Deleted Org',
      slug: 'deleted-org',
      deletedAt: new Date(),
    };

    it('削除済み組織を復元できる', async () => {
      mockOrgRepo.findDeletedById.mockResolvedValue(mockDeletedOrg);
      mockOrgRepo.restore.mockResolvedValue({
        ...mockDeletedOrg,
        deletedAt: null,
      });

      const result = await service.restore('org-1', 'user-1');

      expect(mockOrgRepo.findDeletedById).toHaveBeenCalledWith('org-1');
      expect(mockOrgRepo.restore).toHaveBeenCalledWith('org-1');
      expect(result.deletedAt).toBeNull();
    });

    it('削除済み組織が見つからない場合はNotFoundErrorを投げる', async () => {
      mockOrgRepo.findDeletedById.mockResolvedValue(null);

      await expect(service.restore('invalid-org', 'user-1'))
        .rejects.toThrow(NotFoundError);
    });

    it('猶予期間（30日）を過ぎている場合はConflictErrorを投げる', async () => {
      // 31日前に削除された組織
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 31);
      const expiredOrg = {
        ...mockDeletedOrg,
        deletedAt,
      };
      mockOrgRepo.findDeletedById.mockResolvedValue(expiredOrg);

      await expect(service.restore('org-1', 'user-1'))
        .rejects.toThrow(ConflictError);
    });

    it('猶予期間内（29日目）の組織は復元できる', async () => {
      // 29日前に削除された組織
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 29);
      const recentlyDeletedOrg = {
        ...mockDeletedOrg,
        deletedAt,
      };
      mockOrgRepo.findDeletedById.mockResolvedValue(recentlyDeletedOrg);
      mockOrgRepo.restore.mockResolvedValue({
        ...recentlyDeletedOrg,
        deletedAt: null,
      });

      const result = await service.restore('org-1', 'user-1');

      expect(result.deletedAt).toBeNull();
    });

    it('猶予期間のちょうど30日目の組織は復元できる', async () => {
      // ちょうど30日前の削除（境界値テスト）
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 30);
      // 時刻をずらして猶予期間内に収める
      deletedAt.setHours(deletedAt.getHours() + 1);
      const boundaryOrg = {
        ...mockDeletedOrg,
        deletedAt,
      };
      mockOrgRepo.findDeletedById.mockResolvedValue(boundaryOrg);
      mockOrgRepo.restore.mockResolvedValue({
        ...boundaryOrg,
        deletedAt: null,
      });

      const result = await service.restore('org-1', 'user-1');

      expect(result.deletedAt).toBeNull();
    });

    it('復元時に監査ログを記録する', async () => {
      mockOrgRepo.findDeletedById.mockResolvedValue(mockDeletedOrg);
      mockOrgRepo.restore.mockResolvedValue({
        ...mockDeletedOrg,
        deletedAt: null,
      });

      await service.restore('org-1', 'user-1');

      expect(mockAuditLogService.log).toHaveBeenCalledWith({
        userId: 'user-1',
        organizationId: 'org-1',
        category: 'ORGANIZATION',
        action: 'organization.restored',
        targetType: 'Organization',
        targetId: 'org-1',
        details: { name: 'Deleted Org', slug: 'deleted-org' },
      });
    });
  });

  // 監査ログのテスト
  describe('Audit Logging', () => {
    describe('create', () => {
      it('組織作成時に監査ログを記録する', async () => {
        const mockOrg = { id: 'org-1', name: 'Test Org', slug: 'test-org' };
        mockPrisma.organization.findUnique.mockResolvedValue(null);
        mockPrisma.organization.create.mockResolvedValue(mockOrg);
        mockPrisma.organizationMember.create.mockResolvedValue({});

        await service.create('user-1', { name: 'Test Org', slug: 'test-org' });

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'user-1',
          organizationId: 'org-1',
          category: 'ORGANIZATION',
          action: 'organization.created',
          targetType: 'Organization',
          targetId: 'org-1',
          details: { name: 'Test Org', slug: 'test-org' },
        });
      });
    });

    describe('update', () => {
      it('組織更新時に監査ログを記録する', async () => {
        const mockOrg = { id: 'org-1', name: 'Old Name' };
        mockOrgRepo.findById.mockResolvedValue(mockOrg);
        mockOrgRepo.update.mockResolvedValue({ ...mockOrg, name: 'New Name' });

        await service.update('org-1', { name: 'New Name' }, 'user-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'user-1',
          organizationId: 'org-1',
          category: 'ORGANIZATION',
          action: 'organization.updated',
          targetType: 'Organization',
          targetId: 'org-1',
          details: { name: 'New Name' },
        });
      });
    });

    describe('softDelete', () => {
      it('組織削除時に監査ログを記録する', async () => {
        const mockOrg = { id: 'org-1', name: 'Test Org', slug: 'test-org' };
        mockOrgRepo.findById.mockResolvedValue(mockOrg);
        mockOrgRepo.softDelete.mockResolvedValue(mockOrg);

        await service.softDelete('org-1', 'user-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'user-1',
          organizationId: 'org-1',
          category: 'ORGANIZATION',
          action: 'organization.deleted',
          targetType: 'Organization',
          targetId: 'org-1',
          details: { name: 'Test Org', slug: 'test-org' },
        });
      });
    });

    describe('invite', () => {
      it('招待送信時に監査ログを記録する', async () => {
        const mockOrg = { id: 'org-1', name: 'Test Org' };
        const mockInvitation = {
          id: 'inv-1',
          organizationId: 'org-1',
          email: 'newuser@example.com',
          role: 'MEMBER',
        };
        mockOrgRepo.findById.mockResolvedValue(mockOrg);
        mockPrisma.user.findUnique.mockResolvedValue(null);
        mockPrisma.organizationInvitation.findFirst.mockResolvedValue(null);
        mockPrisma.organizationInvitation.create.mockResolvedValue(mockInvitation);

        await service.invite('org-1', 'inviter-1', {
          email: 'newuser@example.com',
          role: 'MEMBER',
        });

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'inviter-1',
          organizationId: 'org-1',
          category: 'MEMBER',
          action: 'member.invited',
          targetType: 'OrganizationInvitation',
          targetId: 'inv-1',
          details: { email: 'newuser@example.com', role: 'MEMBER' },
        });
      });
    });

    describe('acceptInvitation', () => {
      it('招待承認時に監査ログを記録する', async () => {
        const mockUser = { id: 'user-1', email: 'user@example.com' };
        const mockInvitation = {
          id: 'inv-1',
          organizationId: 'org-1',
          email: 'user@example.com',
          role: 'MEMBER',
          token: 'token-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: null,
          declinedAt: null,
          organization: { id: 'org-1', name: 'Test Org' },
        };
        const mockMember = {
          id: 'member-1',
          organizationId: 'org-1',
          userId: 'user-1',
          role: 'MEMBER',
          organization: { id: 'org-1', name: 'Test Org' },
          user: { id: 'user-1', email: 'user@example.com', name: 'User', avatarUrl: null },
        };
        mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrisma.organizationInvitation.update.mockResolvedValue({
          ...mockInvitation,
          acceptedAt: new Date(),
        });
        mockPrisma.organizationMember.create.mockResolvedValue(mockMember);

        await service.acceptInvitation('token-1', 'user-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'user-1',
          organizationId: 'org-1',
          category: 'MEMBER',
          action: 'member.invitation_accepted',
          targetType: 'OrganizationMember',
          targetId: 'member-1',
          details: { email: 'user@example.com', role: 'MEMBER' },
        });
      });
    });

    describe('cancelInvitation', () => {
      it('招待取消時に監査ログを記録する', async () => {
        const mockInvitation = {
          id: 'inv-1',
          organizationId: 'org-1',
          email: 'user@example.com',
          role: 'MEMBER',
          token: 'token-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: null,
          declinedAt: null,
        };
        mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);
        mockPrisma.organizationInvitation.delete.mockResolvedValue(mockInvitation);

        await service.cancelInvitation('org-1', 'inv-1', 'admin-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'admin-1',
          organizationId: 'org-1',
          category: 'MEMBER',
          action: 'member.invitation_cancelled',
          targetType: 'OrganizationInvitation',
          targetId: 'inv-1',
          details: { email: 'user@example.com', role: 'MEMBER' },
        });
      });
    });

    describe('declineInvitation', () => {
      it('招待辞退時に監査ログを記録する', async () => {
        const mockUser = { id: 'user-1', email: 'user@example.com' };
        const mockInvitation = {
          id: 'inv-1',
          organizationId: 'org-1',
          email: 'user@example.com',
          role: 'MEMBER',
          token: 'token-1',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          acceptedAt: null,
          declinedAt: null,
          organization: { id: 'org-1', name: 'Test Org' },
        };
        mockPrisma.organizationInvitation.findUnique.mockResolvedValue(mockInvitation);
        mockPrisma.user.findUnique.mockResolvedValue(mockUser);
        mockPrisma.organizationInvitation.update.mockResolvedValue({
          ...mockInvitation,
          declinedAt: new Date(),
        });

        await service.declineInvitation('token-1', 'user-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'user-1',
          organizationId: 'org-1',
          category: 'MEMBER',
          action: 'member.invitation_declined',
          targetType: 'OrganizationInvitation',
          targetId: 'inv-1',
          details: { email: 'user@example.com' },
        });
      });
    });

    describe('updateMemberRole', () => {
      it('ロール変更時に監査ログを記録する', async () => {
        const mockMember = {
          id: 'member-1',
          organizationId: 'org-1',
          userId: 'member-1',
          role: 'MEMBER',
        };
        mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMember);
        mockPrisma.organizationMember.update.mockResolvedValue({
          ...mockMember,
          role: 'ADMIN',
          user: { id: 'member-1', email: 'member@example.com', name: 'Member', avatarUrl: null },
        });

        await service.updateMemberRole('org-1', 'member-1', 'ADMIN', 'admin-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'admin-1',
          organizationId: 'org-1',
          category: 'MEMBER',
          action: 'member.role_updated',
          targetType: 'OrganizationMember',
          targetId: 'member-1',
          details: {
            targetUserId: 'member-1',
            previousRole: 'MEMBER',
            newRole: 'ADMIN',
          },
        });
      });
    });

    describe('removeMember', () => {
      it('メンバー削除時に監査ログを記録する', async () => {
        const mockMember = {
          id: 'member-1',
          organizationId: 'org-1',
          userId: 'target-user',
          role: 'MEMBER',
          user: { email: 'member@example.com', name: 'Member' },
        };
        mockPrisma.organizationMember.findUnique.mockResolvedValue(mockMember);
        mockPrisma.organizationMember.delete.mockResolvedValue(mockMember);

        await service.removeMember('org-1', 'target-user', 'admin-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'admin-1',
          organizationId: 'org-1',
          category: 'MEMBER',
          action: 'member.removed',
          targetType: 'OrganizationMember',
          targetId: 'member-1',
          details: {
            targetUserId: 'target-user',
            email: 'member@example.com',
            role: 'MEMBER',
          },
        });
      });
    });

    describe('transferOwnership', () => {
      it('オーナー権限移譲時に監査ログを記録する', async () => {
        const mockOrg = { id: 'org-1', name: 'Test Org' };
        const mockCurrentOwner = {
          organizationId: 'org-1',
          userId: 'owner-1',
          role: 'OWNER',
        };
        const mockNewOwner = {
          organizationId: 'org-1',
          userId: 'admin-1',
          role: 'ADMIN',
          user: {
            id: 'admin-1',
            email: 'admin@example.com',
            name: 'Admin User',
            avatarUrl: null,
          },
        };
        mockOrgRepo.findById.mockResolvedValue(mockOrg);
        mockPrisma.organizationMember.findUnique
          .mockResolvedValueOnce(mockCurrentOwner)
          .mockResolvedValueOnce(mockNewOwner);
        mockPrisma.organizationMember.update.mockResolvedValue({
          ...mockNewOwner,
          role: 'OWNER',
        });

        await service.transferOwnership('org-1', 'owner-1', 'admin-1');

        expect(mockAuditLogService.log).toHaveBeenCalledWith({
          userId: 'owner-1',
          organizationId: 'org-1',
          category: 'ORGANIZATION',
          action: 'organization.ownership_transferred',
          targetType: 'Organization',
          targetId: 'org-1',
          details: {
            previousOwnerId: 'owner-1',
            newOwnerId: 'admin-1',
            newOwnerEmail: 'admin@example.com',
          },
        });
      });
    });
  });
});
