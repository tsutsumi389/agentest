import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserService } from '../../services/user.service.js';

// Prismaをモック
vi.mock('@agentest/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
    },
  },
}));

// UserRepositoryをモック
vi.mock('../../repositories/user.repository.js', () => ({
  UserRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  })),
}));

import { prisma } from '@agentest/db';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    vi.clearAllMocks();
    userService = new UserService();
  });

  describe('getOrganizations', () => {
    it('ユーザーの組織一覧をメンバー数付きで取得する', async () => {
      const mockOrganizations = [
        {
          id: 'member-1',
          organizationId: 'org-1',
          userId: 'user-1',
          role: 'OWNER',
          joinedAt: new Date('2024-01-01'),
          organization: {
            id: 'org-1',
            name: 'Test Org 1',
            slug: 'test-org-1',
            description: 'Description 1',
            avatarUrl: null,
            plan: 'FREE',
            createdAt: new Date('2024-01-01'),
            _count: {
              members: 3,
            },
          },
        },
        {
          id: 'member-2',
          organizationId: 'org-2',
          userId: 'user-1',
          role: 'MEMBER',
          joinedAt: new Date('2024-02-01'),
          organization: {
            id: 'org-2',
            name: 'Test Org 2',
            slug: 'test-org-2',
            description: null,
            avatarUrl: 'https://example.com/avatar.png',
            plan: 'PRO',
            createdAt: new Date('2024-02-01'),
            _count: {
              members: 5,
            },
          },
        },
      ];

      vi.mocked(prisma.organizationMember.findMany).mockResolvedValue(mockOrganizations as any);

      const result = await userService.getOrganizations('user-1');

      expect(prisma.organizationMember.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              avatarUrl: true,
              plan: true,
              createdAt: true,
              _count: {
                select: { members: true },
              },
            },
          },
        },
        orderBy: { joinedAt: 'desc' },
      });

      expect(result).toHaveLength(2);
      expect(result[0].organization._count.members).toBe(3);
      expect(result[1].organization._count.members).toBe(5);
    });

    it('所属組織がない場合は空配列を返す', async () => {
      vi.mocked(prisma.organizationMember.findMany).mockResolvedValue([]);

      const result = await userService.getOrganizations('user-1');

      expect(result).toEqual([]);
    });

    it('結果が参加日降順でソートされる', async () => {
      const mockOrganizations = [
        {
          id: 'member-1',
          organizationId: 'org-1',
          userId: 'user-1',
          role: 'OWNER',
          joinedAt: new Date('2024-03-01'),
          organization: {
            id: 'org-1',
            name: 'Newest Org',
            slug: 'newest-org',
            description: null,
            avatarUrl: null,
            plan: 'FREE',
            createdAt: new Date('2024-03-01'),
            _count: { members: 1 },
          },
        },
        {
          id: 'member-2',
          organizationId: 'org-2',
          userId: 'user-1',
          role: 'MEMBER',
          joinedAt: new Date('2024-01-01'),
          organization: {
            id: 'org-2',
            name: 'Oldest Org',
            slug: 'oldest-org',
            description: null,
            avatarUrl: null,
            plan: 'FREE',
            createdAt: new Date('2024-01-01'),
            _count: { members: 2 },
          },
        },
      ];

      vi.mocked(prisma.organizationMember.findMany).mockResolvedValue(mockOrganizations as any);

      const result = await userService.getOrganizations('user-1');

      // モックからの順序を確認（Prismaがソートして返す想定）
      expect(result[0].organization.name).toBe('Newest Org');
      expect(result[1].organization.name).toBe('Oldest Org');
    });
  });
});
