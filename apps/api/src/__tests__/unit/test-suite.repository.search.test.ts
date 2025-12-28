import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestSuiteRepository, type TestSuiteSearchOptions } from '../../repositories/test-suite.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaTestSuite = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    testSuite: mockPrismaTestSuite,
  },
}));

describe('TestSuiteRepository - search', () => {
  let repository: TestSuiteRepository;

  const mockTestSuites = [
    {
      id: 'test-suite-1',
      projectId: 'project-1',
      name: 'ログイン機能テスト',
      description: 'ログイン機能のテストスイート',
      status: 'ACTIVE',
      createdByUserId: 'user-1',
      createdAt: new Date('2025-01-15T10:00:00Z'),
      updatedAt: new Date('2025-01-15T10:00:00Z'),
      deletedAt: null,
      createdByUser: {
        id: 'user-1',
        name: 'Test User',
        avatarUrl: null,
      },
      _count: {
        testCases: 5,
        preconditions: 2,
      },
    },
    {
      id: 'test-suite-2',
      projectId: 'project-1',
      name: 'ユーザー管理テスト',
      description: 'ユーザー管理機能のテストスイート',
      status: 'DRAFT',
      createdByUserId: 'user-2',
      createdAt: new Date('2025-01-14T10:00:00Z'),
      updatedAt: new Date('2025-01-14T10:00:00Z'),
      deletedAt: null,
      createdByUser: {
        id: 'user-2',
        name: 'Another User',
        avatarUrl: null,
      },
      _count: {
        testCases: 3,
        preconditions: 1,
      },
    },
  ];

  const defaultOptions: TestSuiteSearchOptions = {
    limit: 20,
    offset: 0,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    includeDeleted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestSuiteRepository();
  });

  // ============================================================
  // 基本的な検索
  // ============================================================
  describe('基本的な検索', () => {
    it('フィルタなしで検索できる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      const result = await repository.search('project-1', defaultOptions);

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          deletedAt: null,
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { testCases: true, preconditions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result.items).toEqual(mockTestSuites);
      expect(result.total).toBe(2);
    });

    it('結果が0件の場合、空配列と0を返す', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([]);
      mockPrismaTestSuite.count.mockResolvedValue(0);

      const result = await repository.search('project-1', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================
  // キーワード検索
  // ============================================================
  describe('キーワード検索', () => {
    it('名前で部分一致検索できる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      const result = await repository.search('project-1', {
        ...defaultOptions,
        q: 'ログイン',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'ログイン', mode: 'insensitive' } },
              {
                preconditions: {
                  some: {
                    content: { contains: 'ログイン', mode: 'insensitive' },
                  },
                },
              },
            ],
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('前提条件の内容でも検索できる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      await repository.search('project-1', {
        ...defaultOptions,
        q: 'セッション',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'セッション', mode: 'insensitive' } },
              {
                preconditions: {
                  some: {
                    content: { contains: 'セッション', mode: 'insensitive' },
                  },
                },
              },
            ],
          }),
        })
      );
    });

    it('空文字のキーワードは無視される', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      await repository.search('project-1', {
        ...defaultOptions,
        q: '',
      });

      // q が空の場合、ORは設定されない
      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.anything(),
          }),
        })
      );
    });
  });

  // ============================================================
  // ステータスフィルタ
  // ============================================================
  describe('ステータスフィルタ', () => {
    it('ACTIVEステータスでフィルタできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      const result = await repository.search('project-1', {
        ...defaultOptions,
        status: 'ACTIVE',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('DRAFTステータスでフィルタできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[1]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      await repository.search('project-1', {
        ...defaultOptions,
        status: 'DRAFT',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'DRAFT',
          }),
        })
      );
    });

    it('ARCHIVEDステータスでフィルタできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([]);
      mockPrismaTestSuite.count.mockResolvedValue(0);

      await repository.search('project-1', {
        ...defaultOptions,
        status: 'ARCHIVED',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ARCHIVED',
          }),
        })
      );
    });
  });

  // ============================================================
  // 作成者フィルタ
  // ============================================================
  describe('作成者フィルタ', () => {
    it('作成者でフィルタできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      const result = await repository.search('project-1', {
        ...defaultOptions,
        createdBy: 'user-1',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdByUserId: 'user-1',
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('存在しない作成者でフィルタすると0件', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([]);
      mockPrismaTestSuite.count.mockResolvedValue(0);

      const result = await repository.search('project-1', {
        ...defaultOptions,
        createdBy: 'user-999',
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================
  // 日付フィルタ
  // ============================================================
  describe('日付フィルタ', () => {
    it('開始日（from）でフィルタできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      await repository.search('project-1', {
        ...defaultOptions,
        from: '2025-01-15T00:00:00Z',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2025-01-15T00:00:00Z'),
            },
          }),
        })
      );
    });

    it('終了日（to）でフィルタできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[1]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      await repository.search('project-1', {
        ...defaultOptions,
        to: '2025-01-14T23:59:59Z',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              lte: new Date('2025-01-14T23:59:59Z'),
            },
          }),
        })
      );
    });

    it('日付範囲（from〜to）でフィルタできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      await repository.search('project-1', {
        ...defaultOptions,
        from: '2025-01-01T00:00:00Z',
        to: '2025-01-31T23:59:59Z',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2025-01-01T00:00:00Z'),
              lte: new Date('2025-01-31T23:59:59Z'),
            },
          }),
        })
      );
    });
  });

  // ============================================================
  // ページネーション
  // ============================================================
  describe('ページネーション', () => {
    it('limitを指定して件数を制限できる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(10);

      const result = await repository.search('project-1', {
        ...defaultOptions,
        limit: 1,
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it('offsetを指定してスキップできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[1]]);
      mockPrismaTestSuite.count.mockResolvedValue(10);

      await repository.search('project-1', {
        ...defaultOptions,
        offset: 5,
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
        })
      );
    });

    it('2ページ目を取得できる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[1]]);
      mockPrismaTestSuite.count.mockResolvedValue(25);

      await repository.search('project-1', {
        ...defaultOptions,
        limit: 20,
        offset: 20,
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          skip: 20,
        })
      );
    });
  });

  // ============================================================
  // ソート
  // ============================================================
  describe('ソート', () => {
    it('名前で昇順ソートできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      await repository.search('project-1', {
        ...defaultOptions,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      );
    });

    it('名前で降順ソートできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      await repository.search('project-1', {
        ...defaultOptions,
        sortBy: 'name',
        sortOrder: 'desc',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'desc' },
        })
      );
    });

    it('作成日で昇順ソートできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      await repository.search('project-1', {
        ...defaultOptions,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('更新日でソートできる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      await repository.search('project-1', {
        ...defaultOptions,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      );
    });
  });

  // ============================================================
  // 削除済み含む
  // ============================================================
  describe('削除済み含む', () => {
    it('削除済みを含めて検索できる', async () => {
      const testSuitesWithDeleted = [
        ...mockTestSuites,
        {
          ...mockTestSuites[0],
          id: 'test-suite-3',
          deletedAt: new Date('2025-01-16T10:00:00Z'),
        },
      ];
      mockPrismaTestSuite.findMany.mockResolvedValue(testSuitesWithDeleted);
      mockPrismaTestSuite.count.mockResolvedValue(3);

      const result = await repository.search('project-1', {
        ...defaultOptions,
        includeDeleted: true,
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: undefined,
          }),
        })
      );
      expect(result.items).toHaveLength(3);
    });

    it('削除済みを含めない場合はdeletedAtがnullのみ', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      await repository.search('project-1', {
        ...defaultOptions,
        includeDeleted: false,
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  // ============================================================
  // 複合条件
  // ============================================================
  describe('複合条件', () => {
    it('キーワード + ステータス + 日付範囲で検索できる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      await repository.search('project-1', {
        ...defaultOptions,
        q: 'ログイン',
        status: 'ACTIVE',
        from: '2025-01-01T00:00:00Z',
        to: '2025-01-31T23:59:59Z',
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            projectId: 'project-1',
            status: 'ACTIVE',
            deletedAt: null,
            createdAt: {
              gte: new Date('2025-01-01T00:00:00Z'),
              lte: new Date('2025-01-31T23:59:59Z'),
            },
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('全てのフィルタを組み合わせて検索できる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue([mockTestSuites[0]]);
      mockPrismaTestSuite.count.mockResolvedValue(1);

      await repository.search('project-1', {
        q: 'テスト',
        status: 'ACTIVE',
        createdBy: 'user-1',
        from: '2025-01-01T00:00:00Z',
        to: '2025-01-31T23:59:59Z',
        limit: 10,
        offset: 0,
        sortBy: 'name',
        sortOrder: 'asc',
        includeDeleted: false,
      });

      expect(mockPrismaTestSuite.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          deletedAt: null,
          status: 'ACTIVE',
          createdByUserId: 'user-1',
          createdAt: {
            gte: new Date('2025-01-01T00:00:00Z'),
            lte: new Date('2025-01-31T23:59:59Z'),
          },
          OR: [
            { name: { contains: 'テスト', mode: 'insensitive' } },
            {
              preconditions: {
                some: {
                  content: { contains: 'テスト', mode: 'insensitive' },
                },
              },
            },
          ],
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { testCases: true, preconditions: true },
          },
        },
        orderBy: { name: 'asc' },
        take: 10,
        skip: 0,
      });
    });
  });

  // ============================================================
  // 戻り値の構造
  // ============================================================
  describe('戻り値の構造', () => {
    it('itemsとtotalを含むオブジェクトを返す', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      const result = await repository.search('project-1', defaultOptions);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('各アイテムに作成者情報が含まれる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      const result = await repository.search('project-1', defaultOptions);

      expect(result.items[0].createdByUser).toEqual({
        id: 'user-1',
        name: 'Test User',
        avatarUrl: null,
      });
    });

    it('各アイテムにカウント情報が含まれる', async () => {
      mockPrismaTestSuite.findMany.mockResolvedValue(mockTestSuites);
      mockPrismaTestSuite.count.mockResolvedValue(2);

      const result = await repository.search('project-1', defaultOptions);

      expect(result.items[0]._count).toEqual({
        testCases: 5,
        preconditions: 2,
      });
    });
  });
});
