import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ConflictError, AuthorizationError } from '@agentest/shared';

// OrganizationRepository のモック
const mockOrgRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findBySlug: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('../../repositories/organization.repository.js', () => ({
  OrganizationRepository: vi.fn().mockImplementation(() => mockOrgRepo),
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
});
