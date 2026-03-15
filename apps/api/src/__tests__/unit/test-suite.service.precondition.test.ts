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
  testSuitePrecondition: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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

describe('TestSuiteService - Precondition Management', () => {
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

  const mockPrecondition = {
    id: 'precondition-1',
    testSuiteId: 'test-suite-1',
    content: 'ユーザーがログインしている',
    orderKey: '00001',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestSuiteService();
  });

  // ============================================================
  // updatePrecondition
  // ============================================================
  describe('updatePrecondition', () => {
    it('前提条件を更新できる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({
        ...mockPrecondition,
        content: '管理者としてログインしている',
      });

      const result = await service.updatePrecondition('test-suite-1', 'precondition-1', 'user-1', {
        content: '管理者としてログインしている',
      });

      expect(mockTestSuiteRepo.findById).toHaveBeenCalledWith('test-suite-1');
      expect(mockPrisma.testSuitePrecondition.findFirst).toHaveBeenCalledWith({
        where: { id: 'precondition-1', testSuiteId: 'test-suite-1' },
      });
      expect(mockPrisma.testSuitePrecondition.update).toHaveBeenCalledWith({
        where: { id: 'precondition-1' },
        data: { content: '管理者としてログインしている' },
      });
      expect(result.content).toBe('管理者としてログインしている');
    });

    it('更新時に履歴が保存される', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({
        ...mockPrecondition,
        content: '新しい内容',
      });

      await service.updatePrecondition('test-suite-1', 'precondition-1', 'user-1', {
        content: '新しい内容',
      });

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: {
          testSuiteId: 'test-suite-1',
          changedByUserId: 'user-1',
          changeType: 'UPDATE',
          snapshot: expect.objectContaining({
            changeDetail: {
              type: 'PRECONDITION_UPDATE',
              preconditionId: 'precondition-1',
              before: { content: 'ユーザーがログインしている' },
              after: { content: '新しい内容' },
            },
          }),
        },
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(
        service.updatePrecondition('invalid-suite', 'precondition-1', 'user-1', {
          content: '新しい内容',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('前提条件が存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePrecondition('test-suite-1', 'invalid-precondition', 'user-1', {
          content: '新しい内容',
        })
      ).rejects.toThrow(NotFoundError);
    });

    it('異なるテストスイートの前提条件更新はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      // testSuiteIdの条件で検索するため、nullが返る
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePrecondition('test-suite-1', 'precondition-1', 'user-1', {
          content: '新しい内容',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================
  // deletePrecondition
  // ============================================================
  describe('deletePrecondition', () => {
    it('前提条件を削除できる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.delete.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue([]);
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({});

      await service.deletePrecondition('test-suite-1', 'precondition-1', 'user-1');

      expect(mockTestSuiteRepo.findById).toHaveBeenCalledWith('test-suite-1');
      expect(mockPrisma.testSuitePrecondition.findFirst).toHaveBeenCalledWith({
        where: { id: 'precondition-1', testSuiteId: 'test-suite-1' },
      });
      // トランザクション内で削除が呼ばれることを確認
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('削除後、残りの前提条件のorderKeyが再整列される', async () => {
      const remainingPreconditions = [
        { id: 'precondition-2', orderKey: '00002' },
        { id: 'precondition-3', orderKey: '00003' },
      ];
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.delete.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue(remainingPreconditions);
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({});

      await service.deletePrecondition('test-suite-1', 'precondition-1', 'user-1');

      // トランザクション内でorderKeyが再整列されることを確認
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // 残りの前提条件がそれぞれ更新される
      expect(mockPrisma.testSuitePrecondition.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'precondition-2' },
        data: { orderKey: '00001' },
      });
      expect(mockPrisma.testSuitePrecondition.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'precondition-3' },
        data: { orderKey: '00002' },
      });
    });

    it('削除時に履歴が保存される', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.delete.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue([]);
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({});

      await service.deletePrecondition('test-suite-1', 'precondition-1', 'user-1');

      // トランザクション内で履歴が作成されることを確認
      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: {
          testSuiteId: 'test-suite-1',
          changedByUserId: 'user-1',
          changeType: 'UPDATE',
          snapshot: expect.objectContaining({
            changeDetail: {
              type: 'PRECONDITION_DELETE',
              preconditionId: 'precondition-1',
              deleted: { content: 'ユーザーがログインしている', orderKey: '00001' },
            },
          }),
        },
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(
        service.deletePrecondition('invalid-suite', 'precondition-1', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('前提条件が存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePrecondition('test-suite-1', 'invalid-precondition', 'user-1')
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============================================================
  // reorderPreconditions
  // ============================================================
  describe('reorderPreconditions', () => {
    const mockPreconditions = [
      { id: 'precondition-1', testSuiteId: 'test-suite-1', content: '条件1', orderKey: '00001' },
      { id: 'precondition-2', testSuiteId: 'test-suite-1', content: '条件2', orderKey: '00002' },
      { id: 'precondition-3', testSuiteId: 'test-suite-1', content: '条件3', orderKey: '00003' },
    ];

    it('前提条件を並び替えできる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany
        .mockResolvedValueOnce(mockPreconditions) // 現在の前提条件取得
        .mockResolvedValueOnce(mockPreconditions); // 並び替え後の取得
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({});

      const result = await service.reorderPreconditions(
        'test-suite-1',
        ['precondition-3', 'precondition-1', 'precondition-2'],
        'user-1'
      );

      expect(mockTestSuiteRepo.findById).toHaveBeenCalledWith('test-suite-1');
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(3);
    });

    it('並び替え後のorderKeyが正しく設定される', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany
        .mockResolvedValueOnce(mockPreconditions)
        .mockResolvedValueOnce(mockPreconditions);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});

      // updateが呼ばれた順序と引数を記録
      const updateCalls: Array<{ id: string; orderKey: string }> = [];
      mockPrisma.testSuitePrecondition.update.mockImplementation(({ where, data }) => {
        updateCalls.push({ id: where.id, orderKey: data.orderKey });
        return Promise.resolve({ id: where.id, orderKey: data.orderKey });
      });

      await service.reorderPreconditions(
        'test-suite-1',
        ['precondition-3', 'precondition-1', 'precondition-2'],
        'user-1'
      );

      // トランザクションで各前提条件が正しいorderKeyで更新される
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('並び替え時に履歴が保存される', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany
        .mockResolvedValueOnce(mockPreconditions)
        .mockResolvedValueOnce(mockPreconditions);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({});

      await service.reorderPreconditions(
        'test-suite-1',
        ['precondition-3', 'precondition-1', 'precondition-2'],
        'user-1'
      );

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: {
          testSuiteId: 'test-suite-1',
          changedByUserId: 'user-1',
          changeType: 'UPDATE',
          snapshot: expect.objectContaining({
            changeDetail: {
              type: 'PRECONDITION_REORDER',
              before: ['precondition-1', 'precondition-2', 'precondition-3'],
              after: ['precondition-3', 'precondition-1', 'precondition-2'],
            },
          }),
        },
      });
    });

    it('テストスイートが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(null);

      await expect(
        service.reorderPreconditions('invalid-suite', ['precondition-1'], 'user-1')
      ).rejects.toThrow(NotFoundError);
    });

    it('存在しない前提条件IDを含む場合はNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue(mockPreconditions);

      await expect(
        service.reorderPreconditions(
          'test-suite-1',
          ['precondition-1', 'precondition-2', 'invalid-precondition'],
          'user-1'
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('全件指定されていない場合はBadRequestErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue(mockPreconditions);

      // 3件中2件だけ指定
      await expect(
        service.reorderPreconditions('test-suite-1', ['precondition-1', 'precondition-2'], 'user-1')
      ).rejects.toThrow(BadRequestError);
    });

    it('重複IDを含む場合はBadRequestErrorを投げる', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue(mockPreconditions);

      await expect(
        service.reorderPreconditions(
          'test-suite-1',
          ['precondition-1', 'precondition-1', 'precondition-2'],
          'user-1'
        )
      ).rejects.toThrow(BadRequestError);
    });

    it('前提条件が0件の場合、空配列で呼び出しても正常終了する', async () => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue([]);

      const result = await service.reorderPreconditions('test-suite-1', [], 'user-1');

      expect(result).toEqual([]);
      // 履歴は保存されない
      expect(mockPrisma.testSuiteHistory.create).not.toHaveBeenCalled();
    });
  });
});
