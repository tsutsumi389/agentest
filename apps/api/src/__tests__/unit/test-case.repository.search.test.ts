import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TestCaseRepository,
  type TestCaseSearchOptions,
} from '../../repositories/test-case.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaTestCase = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    testCase: mockPrismaTestCase,
  },
}));

describe('TestCaseRepository - search', () => {
  let repository: TestCaseRepository;

  const mockTestCases = [
    {
      id: 'test-case-1',
      testSuiteId: 'test-suite-1',
      title: 'ログイン成功テスト',
      description: 'ログイン機能のテストケース',
      priority: 'HIGH',
      status: 'ACTIVE',
      orderKey: '00001',
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
        preconditions: 2,
        steps: 5,
        expectedResults: 3,
      },
    },
    {
      id: 'test-case-2',
      testSuiteId: 'test-suite-1',
      title: 'ログイン失敗テスト',
      description: 'パスワード間違い時のテスト',
      priority: 'MEDIUM',
      status: 'DRAFT',
      orderKey: '00002',
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
        preconditions: 1,
        steps: 3,
        expectedResults: 2,
      },
    },
  ];

  const defaultOptions: TestCaseSearchOptions = {
    limit: 20,
    offset: 0,
    sortBy: 'orderKey',
    sortOrder: 'asc',
    includeDeleted: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestCaseRepository();
  });

  // ============================================================
  // 基本的な検索
  // ============================================================
  describe('基本的な検索', () => {
    it('フィルタなしで検索できる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      const result = await repository.search('test-suite-1', defaultOptions);

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith({
        where: {
          testSuiteId: 'test-suite-1',
          deletedAt: null,
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { preconditions: true, steps: true, expectedResults: true },
          },
        },
        orderBy: { orderKey: 'asc' },
        take: 20,
        skip: 0,
      });
      expect(result.items).toEqual(mockTestCases);
      expect(result.total).toBe(2);
    });

    it('結果が0件の場合、空配列と0を返す', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([]);
      mockPrismaTestCase.count.mockResolvedValue(0);

      const result = await repository.search('test-suite-1', defaultOptions);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  // ============================================================
  // キーワード検索
  // ============================================================
  describe('キーワード検索', () => {
    it('タイトルで部分一致検索できる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(1);

      const result = await repository.search('test-suite-1', {
        ...defaultOptions,
        q: '成功',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { title: { contains: '成功', mode: 'insensitive' } },
              { steps: { some: { content: { contains: '成功', mode: 'insensitive' } } } },
              { expectedResults: { some: { content: { contains: '成功', mode: 'insensitive' } } } },
            ],
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('手順の内容でも検索できる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(1);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        q: 'クリック',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { steps: { some: { content: { contains: 'クリック', mode: 'insensitive' } } } },
            ]),
          }),
        })
      );
    });

    it('期待結果の内容でも検索できる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(1);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        q: '表示される',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              {
                expectedResults: {
                  some: { content: { contains: '表示される', mode: 'insensitive' } },
                },
              },
            ]),
          }),
        })
      );
    });

    it('空文字のキーワードは無視される', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        q: '',
      });

      // q が空の場合、ORは設定されない
      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            OR: expect.anything(),
          }),
        })
      );
    });
  });

  // ============================================================
  // ステータスフィルタ（複数選択）
  // ============================================================
  describe('ステータスフィルタ', () => {
    it('ACTIVEステータスでフィルタできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(1);

      const result = await repository.search('test-suite-1', {
        ...defaultOptions,
        status: ['ACTIVE'],
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['ACTIVE'] },
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('複数のステータスでフィルタできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        status: ['ACTIVE', 'DRAFT'],
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['ACTIVE', 'DRAFT'] },
          }),
        })
      );
    });

    it('空の配列はステータスフィルタを適用しない', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        status: [],
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            status: expect.anything(),
          }),
        })
      );
    });
  });

  // ============================================================
  // 優先度フィルタ（複数選択）
  // ============================================================
  describe('優先度フィルタ', () => {
    it('HIGHでフィルタできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(1);

      const result = await repository.search('test-suite-1', {
        ...defaultOptions,
        priority: ['HIGH'],
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: { in: ['HIGH'] },
          }),
        })
      );
      expect(result.items).toHaveLength(1);
    });

    it('複数の優先度でフィルタできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        priority: ['HIGH', 'MEDIUM'],
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: { in: ['HIGH', 'MEDIUM'] },
          }),
        })
      );
    });

    it('空の配列は優先度フィルタを適用しない', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        priority: [],
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            priority: expect.anything(),
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
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(10);

      const result = await repository.search('test-suite-1', {
        ...defaultOptions,
        limit: 1,
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        })
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it('offsetを指定してスキップできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[1]]);
      mockPrismaTestCase.count.mockResolvedValue(10);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        offset: 5,
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
        })
      );
    });

    it('2ページ目を取得できる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[1]]);
      mockPrismaTestCase.count.mockResolvedValue(25);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        limit: 20,
        offset: 20,
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
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
    it('タイトルで昇順ソートできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        sortBy: 'title',
        sortOrder: 'asc',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'asc' },
        })
      );
    });

    it('タイトルで降順ソートできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        sortBy: 'title',
        sortOrder: 'desc',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: 'desc' },
        })
      );
    });

    it('作成日で昇順ソートできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        })
      );
    });

    it('更新日でソートできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { updatedAt: 'desc' },
        })
      );
    });

    it('優先度でソートできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        sortBy: 'priority',
        sortOrder: 'desc',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { priority: 'desc' },
        })
      );
    });

    it('並び順キーでソートできる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        sortBy: 'orderKey',
        sortOrder: 'asc',
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { orderKey: 'asc' },
        })
      );
    });
  });

  // ============================================================
  // 削除済み含む
  // ============================================================
  describe('削除済み含む', () => {
    it('削除済みを含めて検索できる', async () => {
      const testCasesWithDeleted = [
        ...mockTestCases,
        {
          ...mockTestCases[0],
          id: 'test-case-3',
          deletedAt: new Date('2025-01-16T10:00:00Z'),
        },
      ];
      mockPrismaTestCase.findMany.mockResolvedValue(testCasesWithDeleted);
      mockPrismaTestCase.count.mockResolvedValue(3);

      const result = await repository.search('test-suite-1', {
        ...defaultOptions,
        includeDeleted: true,
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: undefined,
          }),
        })
      );
      expect(result.items).toHaveLength(3);
    });

    it('削除済みを含めない場合はdeletedAtがnullのみ', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        includeDeleted: false,
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
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
    it('キーワード + ステータス + 優先度で検索できる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(1);

      await repository.search('test-suite-1', {
        ...defaultOptions,
        q: 'ログイン',
        status: ['ACTIVE'],
        priority: ['HIGH'],
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            testSuiteId: 'test-suite-1',
            status: { in: ['ACTIVE'] },
            priority: { in: ['HIGH'] },
            deletedAt: null,
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('全てのフィルタを組み合わせて検索できる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue([mockTestCases[0]]);
      mockPrismaTestCase.count.mockResolvedValue(1);

      await repository.search('test-suite-1', {
        q: 'テスト',
        status: ['ACTIVE', 'DRAFT'],
        priority: ['HIGH', 'MEDIUM'],
        limit: 10,
        offset: 0,
        sortBy: 'title',
        sortOrder: 'asc',
        includeDeleted: false,
      });

      expect(mockPrismaTestCase.findMany).toHaveBeenCalledWith({
        where: {
          testSuiteId: 'test-suite-1',
          deletedAt: null,
          status: { in: ['ACTIVE', 'DRAFT'] },
          priority: { in: ['HIGH', 'MEDIUM'] },
          OR: [
            { title: { contains: 'テスト', mode: 'insensitive' } },
            { steps: { some: { content: { contains: 'テスト', mode: 'insensitive' } } } },
            { expectedResults: { some: { content: { contains: 'テスト', mode: 'insensitive' } } } },
          ],
        },
        include: {
          createdByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { preconditions: true, steps: true, expectedResults: true },
          },
        },
        orderBy: { title: 'asc' },
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
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      const result = await repository.search('test-suite-1', defaultOptions);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.items)).toBe(true);
      expect(typeof result.total).toBe('number');
    });

    it('各アイテムに作成者情報が含まれる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      const result = await repository.search('test-suite-1', defaultOptions);

      expect(result.items[0].createdByUser).toEqual({
        id: 'user-1',
        name: 'Test User',
        avatarUrl: null,
      });
    });

    it('各アイテムにカウント情報が含まれる', async () => {
      mockPrismaTestCase.findMany.mockResolvedValue(mockTestCases);
      mockPrismaTestCase.count.mockResolvedValue(2);

      const result = await repository.search('test-suite-1', defaultOptions);

      expect(result.items[0]._count).toEqual({
        preconditions: 2,
        steps: 5,
        expectedResults: 3,
      });
    });
  });
});
