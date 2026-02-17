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
    testSuite: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    execution: {
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
            description: 'Description 1',
            avatarUrl: null,

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
            description: null,
            avatarUrl: 'https://example.com/avatar.png',

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
              description: true,
              avatarUrl: true,

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
            description: null,
            avatarUrl: null,

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
            description: null,
            avatarUrl: null,

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
        description: 'Description 2',
        organizationId: 'org-1',
        deletedAt: null,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-15'),
        organization: { id: 'org-1', name: 'Org 1' },
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
            select: { id: true, name: true },
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

  describe('getTestSuites', () => {
    const mockTestSuites = [
      {
        id: 'suite-1',
        name: 'Test Suite 1',
        description: 'Description 1',
        status: 'ACTIVE',
        projectId: 'project-1',
        deletedAt: null,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-15'),
        project: { id: 'project-1', name: 'Project 1' },
        createdByUser: { id: 'user-1', name: 'User 1', avatarUrl: null },
        _count: { testCases: 5, preconditions: 2 },
      },
      {
        id: 'suite-2',
        name: 'Test Suite 2',
        description: null,
        status: 'DRAFT',
        projectId: 'project-2',
        deletedAt: null,
        createdAt: new Date('2024-02-01'),
        updatedAt: new Date('2024-02-15'),
        project: { id: 'project-2', name: 'Project 2' },
        createdByUser: null,
        _count: { testCases: 0, preconditions: 0 },
      },
    ];

    it('アクセス可能なテストスイート一覧を取得する（デフォルトオプション）', async () => {
      vi.mocked(prisma.testSuite.findMany).mockResolvedValue(mockTestSuites as any);

      const result = await userService.getTestSuites('user-1');

      expect(prisma.testSuite.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          project: {
            OR: [
              { members: { some: { userId: 'user-1' } } },
              { organization: { members: { some: { userId: 'user-1' } } } },
            ],
            deletedAt: null,
          },
        },
        include: {
          project: { select: { id: true, name: true } },
          createdByUser: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { testCases: true, preconditions: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        skip: 0,
      });

      expect(result).toHaveLength(2);
      expect(result[0]._count.testCases).toBe(5);
    });

    it('プロジェクトIDで絞り込める（認可チェック付き）', async () => {
      vi.mocked(prisma.testSuite.findMany).mockResolvedValue([]);

      await userService.getTestSuites('user-1', { projectId: 'project-1' });

      expect(prisma.testSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            project: {
              OR: [
                { members: { some: { userId: 'user-1' } } },
                { organization: { members: { some: { userId: 'user-1' } } } },
              ],
              deletedAt: null,
            },
          }),
        })
      );
    });

    it('名前で部分一致検索できる（qオプション）', async () => {
      vi.mocked(prisma.testSuite.findMany).mockResolvedValue([]);

      await userService.getTestSuites('user-1', { q: 'search' });

      expect(prisma.testSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'search', mode: 'insensitive' },
          }),
        })
      );
    });

    it('ステータスでフィルタできる', async () => {
      vi.mocked(prisma.testSuite.findMany).mockResolvedValue([]);

      await userService.getTestSuites('user-1', { status: 'ACTIVE' });

      expect(prisma.testSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('ページネーションが動作する（limit/offsetオプション）', async () => {
      vi.mocked(prisma.testSuite.findMany).mockResolvedValue([]);

      await userService.getTestSuites('user-1', { limit: 10, offset: 20 });

      expect(prisma.testSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });

    it('複数条件を組み合わせて検索できる', async () => {
      vi.mocked(prisma.testSuite.findMany).mockResolvedValue([]);

      await userService.getTestSuites('user-1', {
        projectId: 'project-1',
        q: 'search',
        status: 'DRAFT',
        limit: 15,
        offset: 5,
      });

      expect(prisma.testSuite.findMany).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          name: { contains: 'search', mode: 'insensitive' },
          status: 'DRAFT',
          projectId: 'project-1',
          project: {
            OR: [
              { members: { some: { userId: 'user-1' } } },
              { organization: { members: { some: { userId: 'user-1' } } } },
            ],
            deletedAt: null,
          },
        },
        include: expect.any(Object),
        orderBy: { updatedAt: 'desc' },
        take: 15,
        skip: 5,
      });
    });

    it('テストスイートがない場合は空配列を返す', async () => {
      vi.mocked(prisma.testSuite.findMany).mockResolvedValue([]);

      const result = await userService.getTestSuites('user-1');

      expect(result).toEqual([]);
    });
  });

  describe('countTestSuites', () => {
    it('デフォルトオプションでテストスイート数を取得する', async () => {
      vi.mocked(prisma.testSuite.count).mockResolvedValue(10);

      const result = await userService.countTestSuites('user-1');

      expect(prisma.testSuite.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          project: {
            OR: [
              { members: { some: { userId: 'user-1' } } },
              { organization: { members: { some: { userId: 'user-1' } } } },
            ],
            deletedAt: null,
          },
        },
      });
      expect(result).toBe(10);
    });

    it('プロジェクトIDで絞り込んでカウントする（認可チェック付き）', async () => {
      vi.mocked(prisma.testSuite.count).mockResolvedValue(3);

      await userService.countTestSuites('user-1', { projectId: 'project-1' });

      expect(prisma.testSuite.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            project: {
              OR: [
                { members: { some: { userId: 'user-1' } } },
                { organization: { members: { some: { userId: 'user-1' } } } },
              ],
              deletedAt: null,
            },
          }),
        })
      );
    });

    it('名前で部分一致検索してカウントする', async () => {
      vi.mocked(prisma.testSuite.count).mockResolvedValue(2);

      await userService.countTestSuites('user-1', { q: 'test' });

      expect(prisma.testSuite.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'test', mode: 'insensitive' },
          }),
        })
      );
    });

    it('ステータスでフィルタしてカウントする', async () => {
      vi.mocked(prisma.testSuite.count).mockResolvedValue(5);

      await userService.countTestSuites('user-1', { status: 'ACTIVE' });

      expect(prisma.testSuite.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('複数条件を組み合わせてカウントする', async () => {
      vi.mocked(prisma.testSuite.count).mockResolvedValue(4);

      await userService.countTestSuites('user-1', {
        projectId: 'project-1',
        q: 'search',
        status: 'ARCHIVED',
      });

      expect(prisma.testSuite.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          name: { contains: 'search', mode: 'insensitive' },
          status: 'ARCHIVED',
          projectId: 'project-1',
          project: {
            OR: [
              { members: { some: { userId: 'user-1' } } },
              { organization: { members: { some: { userId: 'user-1' } } } },
            ],
            deletedAt: null,
          },
        },
      });
    });

    it('該当なしの場合は0を返す', async () => {
      vi.mocked(prisma.testSuite.count).mockResolvedValue(0);

      const result = await userService.countTestSuites('user-1', { q: 'nonexistent' });

      expect(result).toBe(0);
    });
  });

  describe('getRecentExecutions', () => {
    const mockExecutions = [
      {
        id: 'exec-1',
        environmentId: 'env-1',
        testSuiteId: 'suite-1',
        createdAt: new Date('2024-03-01T10:00:00Z'),
        testSuite: {
          id: 'suite-1',
          name: 'Test Suite 1',
          project: {
            id: 'project-1',
            name: 'Project 1',
          },
        },
        environment: {
          id: 'env-1',
          name: 'Production',
        },
        expectedResults: [
          { status: 'PASS' },
          { status: 'PASS' },
          { status: 'FAIL' },
          { status: 'PENDING' },
          { status: 'SKIPPED' },
        ],
      },
      {
        id: 'exec-2',
        environmentId: null,
        testSuiteId: 'suite-2',
        createdAt: new Date('2024-02-15T10:00:00Z'),
        testSuite: {
          id: 'suite-2',
          name: 'Test Suite 2',
          project: {
            id: 'project-2',
            name: 'Project 2',
          },
        },
        environment: null,
        expectedResults: [
          { status: 'PASS' },
          { status: 'PASS' },
        ],
      },
    ];

    it('デフォルトlimit（10件）で実行結果を取得する', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue(mockExecutions as any);

      await userService.getRecentExecutions('user-1');

      expect(prisma.execution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      );
    });

    it('limit指定で取得件数を制限できる', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue(mockExecutions as any);

      await userService.getRecentExecutions('user-1', 5);

      expect(prisma.execution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      );
    });

    it('アクセス可能なプロジェクトのみ取得する', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);

      await userService.getRecentExecutions('user-1');

      // 直接メンバー or 組織経由のOR条件を確認
      expect(prisma.execution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            testSuite: {
              deletedAt: null,
              project: {
                deletedAt: null,
                OR: [
                  { members: { some: { userId: 'user-1' } } },
                  { organization: { members: { some: { userId: 'user-1' } } } },
                ],
              },
            },
          },
        })
      );
    });

    it('削除済みプロジェクトを除外する', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);

      await userService.getRecentExecutions('user-1');

      expect(prisma.execution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            testSuite: expect.objectContaining({
              project: expect.objectContaining({
                deletedAt: null,
              }),
            }),
          },
        })
      );
    });

    it('削除済みテストスイートを除外する', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);

      await userService.getRecentExecutions('user-1');

      expect(prisma.execution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            testSuite: expect.objectContaining({
              deletedAt: null,
            }),
          },
        })
      );
    });

    it('judgmentCountsを正しく集計する（全種類）', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([mockExecutions[0]] as any);

      const result = await userService.getRecentExecutions('user-1');

      expect(result[0].judgmentCounts).toEqual({
        PASS: 2,
        FAIL: 1,
        PENDING: 1,
        SKIPPED: 1,
      });
    });

    it('judgmentCountsを正しく集計する（一部のみ）', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([mockExecutions[1]] as any);

      const result = await userService.getRecentExecutions('user-1');

      // 存在しないステータスは0
      expect(result[0].judgmentCounts).toEqual({
        PASS: 2,
        FAIL: 0,
        PENDING: 0,
        SKIPPED: 0,
      });
    });

    it('環境情報ありの場合は{id,name}を返す', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([mockExecutions[0]] as any);

      const result = await userService.getRecentExecutions('user-1');

      expect(result[0].environment).toEqual({
        id: 'env-1',
        name: 'Production',
      });
    });

    it('環境情報なしの場合はnullを返す', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([mockExecutions[1]] as any);

      const result = await userService.getRecentExecutions('user-1');

      expect(result[0].environment).toBeNull();
    });

    it('実行がない場合は空配列を返す', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue([]);

      const result = await userService.getRecentExecutions('user-1');

      expect(result).toEqual([]);
    });

    it('createdAt降順でソートされる', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue(mockExecutions as any);

      await userService.getRecentExecutions('user-1');

      expect(prisma.execution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: {
            createdAt: 'desc',
          },
        })
      );
    });

    it('結果が正しい形式で返される', async () => {
      vi.mocked(prisma.execution.findMany).mockResolvedValue(mockExecutions as any);

      const result = await userService.getRecentExecutions('user-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        executionId: 'exec-1',
        projectId: 'project-1',
        projectName: 'Project 1',
        testSuiteId: 'suite-1',
        testSuiteName: 'Test Suite 1',
        environment: { id: 'env-1', name: 'Production' },
        createdAt: '2024-03-01T10:00:00.000Z',
        judgmentCounts: {
          PASS: 2,
          FAIL: 1,
          PENDING: 1,
          SKIPPED: 1,
        },
      });
    });
  });
});
