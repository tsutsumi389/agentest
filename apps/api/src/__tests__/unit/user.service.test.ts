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
      count: vi.fn(),
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
        where: {
          userId: 'user-1',
          organization: { deletedAt: null },
        },
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
              deletedAt: true,
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

    it('削除済み組織も含めて取得できる（includeDeleted=true）', async () => {
      vi.mocked(prisma.organizationMember.findMany).mockResolvedValue([]);

      await userService.getOrganizations('user-1', { includeDeleted: true });

      expect(prisma.organizationMember.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          organization: undefined,
        },
        include: expect.any(Object),
        orderBy: { joinedAt: 'desc' },
      });
    });
  });

  describe('getProjects', () => {
    const mockProjects = [
      {
        id: 'project-1',
        name: 'Project 1',
        slug: 'project-1',
        description: 'Description 1',
        organizationId: null,
        deletedAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        organization: null,
        members: [{ role: 'OWNER' }], // オーナーはmembersに含まれる
        _count: { testSuites: 2 },
      },
      {
        id: 'project-2',
        name: 'Project 2',
        slug: 'project-2',
        description: 'Description 2',
        organizationId: 'org-1',
        deletedAt: null,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-15'),
        organization: { id: 'org-1', name: 'Org 1', slug: 'org-1' },
        members: [{ role: 'WRITE' }],
        _count: { testSuites: 5 },
      },
    ];

    it('ユーザーのプロジェクト一覧を取得する（デフォルトオプション）', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue(mockProjects as any);

      const result = await userService.getProjects('user-1');

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { members: { some: { userId: 'user-1' } } },
            { organization: { members: { some: { userId: 'user-1' } } } },
          ],
          deletedAt: null,
        },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          members: {
            where: { userId: 'user-1' },
            select: { role: true },
          },
          _count: {
            select: { testSuites: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      });

      expect(result).toHaveLength(2);
      // オーナーはmembersにOWNERロールで含まれる
      expect(result[0].role).toBe('OWNER');
      // メンバーの場合はmembersから取得したロール
      expect(result[1].role).toBe('WRITE');
    });

    it('名前で部分一致検索できる（qオプション）', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await userService.getProjects('user-1', { q: 'test' });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'test', mode: 'insensitive' },
          }),
        })
      );
    });

    it('組織でフィルタできる（organizationIdオプション）', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await userService.getProjects('user-1', { organizationId: 'org-1' });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('個人プロジェクトのみフィルタできる（organizationId=null）', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await userService.getProjects('user-1', { organizationId: null });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: null,
          }),
        })
      );
    });

    it('削除済みプロジェクトも含めて取得できる（includeDeleted=true）', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await userService.getProjects('user-1', { includeDeleted: true });

      // deletedAt条件が含まれない
      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            deletedAt: expect.anything(),
          }),
        })
      );
    });

    it('ページネーションが動作する（limit/offsetオプション）', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await userService.getProjects('user-1', { limit: 10, offset: 20 });

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('複数条件を組み合わせて検索できる', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      await userService.getProjects('user-1', {
        q: 'search',
        organizationId: 'org-1',
        includeDeleted: true,
        limit: 25,
        offset: 5,
      });

      expect(prisma.project.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { members: { some: { userId: 'user-1' } } },
            { organization: { members: { some: { userId: 'user-1' } } } },
          ],
          name: { contains: 'search', mode: 'insensitive' },
          organizationId: 'org-1',
        },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 25,
        skip: 5,
      });
    });

    it('プロジェクトがない場合は空配列を返す', async () => {
      vi.mocked(prisma.project.findMany).mockResolvedValue([]);

      const result = await userService.getProjects('user-1');

      expect(result).toEqual([]);
    });

    it('メンバーとしてのみ参加しているプロジェクトはメンバーロールを返す', async () => {
      const memberOnlyProject = [
        {
          id: 'project-3',
          name: 'Member Only Project',
          slug: 'member-only',
          description: null,
          organizationId: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          organization: null,
          members: [{ role: 'READ' }],
          _count: { testSuites: 0 },
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(memberOnlyProject as any);

      const result = await userService.getProjects('user-1');

      expect(result[0].role).toBe('READ');
    });

    it('メンバー情報がない場合はREADロールをデフォルトとする', async () => {
      const noMemberInfoProject = [
        {
          id: 'project-4',
          name: 'No Member Info',
          slug: 'no-member',
          description: null,
          organizationId: null,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          organization: null,
          members: [],
          _count: { testSuites: 0 },
        },
      ];

      vi.mocked(prisma.project.findMany).mockResolvedValue(noMemberInfoProject as any);

      const result = await userService.getProjects('user-1');

      expect(result[0].role).toBe('READ');
    });
  });

  describe('countProjects', () => {
    it('デフォルトオプションでプロジェクト数を取得する', async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(5);

      const result = await userService.countProjects('user-1');

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { members: { some: { userId: 'user-1' } } },
            { organization: { members: { some: { userId: 'user-1' } } } },
          ],
          deletedAt: null,
        },
      });
      expect(result).toBe(5);
    });

    it('名前で部分一致検索してカウントする', async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(2);

      await userService.countProjects('user-1', { q: 'test' });

      expect(prisma.project.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'test', mode: 'insensitive' },
          }),
        })
      );
    });

    it('組織でフィルタしてカウントする', async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(3);

      await userService.countProjects('user-1', { organizationId: 'org-1' });

      expect(prisma.project.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: 'org-1',
          }),
        })
      );
    });

    it('個人プロジェクトのみカウントする（organizationId=null）', async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(1);

      await userService.countProjects('user-1', { organizationId: null });

      expect(prisma.project.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: null,
          }),
        })
      );
    });

    it('削除済みを含めてカウントする', async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(10);

      await userService.countProjects('user-1', { includeDeleted: true });

      // deletedAt条件が含まれない
      expect(prisma.project.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { members: { some: { userId: 'user-1' } } },
            { organization: { members: { some: { userId: 'user-1' } } } },
          ],
        },
      });
    });

    it('複数条件を組み合わせてカウントする', async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(4);

      await userService.countProjects('user-1', {
        q: 'search',
        organizationId: 'org-1',
        includeDeleted: false,
      });

      expect(prisma.project.count).toHaveBeenCalledWith({
        where: {
          OR: [
            { members: { some: { userId: 'user-1' } } },
            { organization: { members: { some: { userId: 'user-1' } } } },
          ],
          deletedAt: null,
          name: { contains: 'search', mode: 'insensitive' },
          organizationId: 'org-1',
        },
      });
    });

    it('該当なしの場合は0を返す', async () => {
      vi.mocked(prisma.project.count).mockResolvedValue(0);

      const result = await userService.countProjects('user-1', { q: 'nonexistent' });

      expect(result).toBe(0);
    });
  });
});
