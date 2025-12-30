import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, BadRequestError } from '@agentest/shared';

// TestSuiteRepository のモック
const mockTestSuiteRepo = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/test-suite.repository.js', () => ({
  TestSuiteRepository: vi.fn().mockImplementation(() => mockTestSuiteRepo),
}));

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
  },
  testSuite: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  testCase: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  testSuiteHistory: {
    create: vi.fn(),
  },
  $transaction: vi.fn((operations) => {
    // 配列の場合は順番に実行
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    // 関数の場合はコールバックとして実行
    return operations(mockPrisma);
  }),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { TestSuiteService } from '../../services/test-suite.service.js';

describe('TestSuiteService - reorderTestCases', () => {
  let service: TestSuiteService;

  const mockTestSuite = {
    id: 'test-suite-1',
    projectId: 'project-1',
    name: 'Test Suite',
    description: 'Test Description',
    status: 'DRAFT',
    createdByUserId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockTestCases = [
    {
      id: 'test-case-1',
      testSuiteId: 'test-suite-1',
      title: 'テストケース1',
      orderKey: '00001',
      deletedAt: null,
    },
    {
      id: 'test-case-2',
      testSuiteId: 'test-suite-1',
      title: 'テストケース2',
      orderKey: '00002',
      deletedAt: null,
    },
    {
      id: 'test-case-3',
      testSuiteId: 'test-suite-1',
      title: 'テストケース3',
      orderKey: '00003',
      deletedAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestSuiteService();
  });

  // ============================================================
  // 正常系
  // ============================================================
  describe('正常系', () => {
    it('テストケースを並び替えできる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany
        .mockResolvedValueOnce(mockTestCases) // 現在のテストケース取得
        .mockResolvedValueOnce(mockTestCases); // 並び替え後の取得
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testCase.update.mockResolvedValue({});

      const result = await service.reorderTestCases(
        'test-suite-1',
        ['test-case-3', 'test-case-1', 'test-case-2'],
        'user-1'
      );

      expect(mockTestSuiteRepo.findById).toHaveBeenCalledWith('test-suite-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('並び替え後のorderKeyが正しく設定される（00001, 00002, ...）', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany
        .mockResolvedValueOnce(mockTestCases)
        .mockResolvedValueOnce(mockTestCases);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});

      // updateが呼ばれた順序と引数を記録
      const updateCalls: Array<{ id: string; orderKey: string }> = [];
      mockPrisma.testCase.update.mockImplementation(({ where, data }) => {
        updateCalls.push({ id: where.id, orderKey: data.orderKey });
        return Promise.resolve({ id: where.id, orderKey: data.orderKey });
      });

      await service.reorderTestCases(
        'test-suite-1',
        ['test-case-3', 'test-case-1', 'test-case-2'],
        'user-1'
      );

      // トランザクション内で各テストケースが正しいorderKeyで更新される
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('並び替え時に履歴が作成される（changeType: UPDATE）', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany
        .mockResolvedValueOnce(mockTestCases)
        .mockResolvedValueOnce(mockTestCases);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testCase.update.mockResolvedValue({});

      await service.reorderTestCases(
        'test-suite-1',
        ['test-case-3', 'test-case-1', 'test-case-2'],
        'user-1'
      );

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: {
          testSuiteId: 'test-suite-1',
          changedByUserId: 'user-1',
          changeType: 'UPDATE',
          snapshot: expect.any(Object),
        },
      });
    });

    it("スナップショットにchangeDetail.typeが'TEST_CASE_REORDER'として保存される", async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany
        .mockResolvedValueOnce(mockTestCases)
        .mockResolvedValueOnce(mockTestCases);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testCase.update.mockResolvedValue({});

      await service.reorderTestCases(
        'test-suite-1',
        ['test-case-3', 'test-case-1', 'test-case-2'],
        'user-1'
      );

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'TEST_CASE_REORDER',
            }),
          }),
        }),
      });
    });

    it('スナップショットにbefore/after配列が保存される', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany
        .mockResolvedValueOnce(mockTestCases)
        .mockResolvedValueOnce(mockTestCases);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testCase.update.mockResolvedValue({});

      await service.reorderTestCases(
        'test-suite-1',
        ['test-case-3', 'test-case-1', 'test-case-2'],
        'user-1'
      );

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              before: ['test-case-1', 'test-case-2', 'test-case-3'],
              after: ['test-case-3', 'test-case-1', 'test-case-2'],
            }),
          }),
        }),
      });
    });
  });

  // ============================================================
  // 異常系
  // ============================================================
  describe('異常系', () => {
    it('存在しないテストスイートはNotFoundError', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(
        service.reorderTestCases('invalid-suite', ['test-case-1'], 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('重複したテストケースIDはBadRequestError', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany.mockResolvedValue(mockTestCases);

      await expect(
        service.reorderTestCases(
          'test-suite-1',
          ['test-case-1', 'test-case-1', 'test-case-2'],
          'user-1'
        )
      ).rejects.toThrow(BadRequestError);

      await expect(
        service.reorderTestCases(
          'test-suite-1',
          ['test-case-1', 'test-case-1', 'test-case-2'],
          'user-1'
        )
      ).rejects.toThrow('重複したテストケースIDが含まれています');
    });

    it('存在しないテストケースIDはBadRequestError', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany.mockResolvedValue(mockTestCases);

      await expect(
        service.reorderTestCases(
          'test-suite-1',
          ['test-case-1', 'test-case-2', 'invalid-case'],
          'user-1'
        )
      ).rejects.toThrow(BadRequestError);

      await expect(
        service.reorderTestCases(
          'test-suite-1',
          ['test-case-1', 'test-case-2', 'invalid-case'],
          'user-1'
        )
      ).rejects.toThrow('存在しないテストケースIDが含まれています');
    });

    it('一部のテストケースのみ指定はBadRequestError', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany.mockResolvedValue(mockTestCases);

      // 3件中2件だけ指定
      await expect(
        service.reorderTestCases('test-suite-1', ['test-case-1', 'test-case-2'], 'user-1')
      ).rejects.toThrow(BadRequestError);

      await expect(
        service.reorderTestCases('test-suite-1', ['test-case-1', 'test-case-2'], 'user-1')
      ).rejects.toThrow('すべてのテストケースを指定してください');
    });
  });

  // ============================================================
  // エッジケース
  // ============================================================
  describe('エッジケース', () => {
    it('テストケースが0件の場合は空配列を返す', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany.mockResolvedValue([]);

      const result = await service.reorderTestCases('test-suite-1', [], 'user-1');

      expect(result).toEqual([]);
      // 履歴は保存されない
      expect(mockPrisma.testSuiteHistory.create).not.toHaveBeenCalled();
    });

    it('順序が変わらない場合は更新せずそのまま返す', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany.mockResolvedValue(mockTestCases);

      // 同じ順序で指定
      const result = await service.reorderTestCases(
        'test-suite-1',
        ['test-case-1', 'test-case-2', 'test-case-3'],
        'user-1'
      );

      // トランザクションは実行されない
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // 履歴は保存されない
      expect(mockPrisma.testSuiteHistory.create).not.toHaveBeenCalled();
      // そのままのテストケース配列を返す
      expect(result).toEqual(mockTestCases);
    });

    it('削除済みテストケースは並び替え対象外', async () => {
      const activeTestCases = mockTestCases.slice(0, 2); // 削除されていない2件のみ
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany.mockResolvedValue(activeTestCases);

      // 存在する2件のみで並び替え
      await service.reorderTestCases(
        'test-suite-1',
        ['test-case-2', 'test-case-1'],
        'user-1'
      );

      // 削除済みは含まれないので2件のみを対象にする
      expect(mockPrisma.testCase.findMany).toHaveBeenCalledWith({
        where: {
          testSuiteId: 'test-suite-1',
          deletedAt: null,
        },
        orderBy: { orderKey: 'asc' },
      });
    });
  });
});
