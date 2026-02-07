import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, BadRequestError } from '@agentest/shared';

// トランザクション内モック
const mockTx = vi.hoisted(() => ({
  testCasePrecondition: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  testCaseStep: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  testCaseExpectedResult: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  testCaseHistory: { create: vi.fn() },
  testCase: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  testCasePrecondition: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  testCaseStep: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  testCaseExpectedResult: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  testCaseHistory: { create: vi.fn() },
  testCase: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

const mockTestCaseRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('../../repositories/test-case.repository.js', () => ({
  TestCaseRepository: vi.fn().mockImplementation(() => mockTestCaseRepo),
}));

vi.mock('../../lib/redis-publisher.js', () => ({ publishDashboardUpdated: vi.fn() }));
vi.mock('../../lib/events.js', () => ({ publishTestCaseUpdated: vi.fn() }));

import { TestCaseService } from '../../services/test-case.service.js';
import { TEST_USER_ID, TEST_CASE_ID, PRECONDITION_ID, createMockTestCase } from './test-case.service.test-helpers.js';

describe('TestCaseService（前提条件CRUD）', () => {
  let service: TestCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
    // findByIdで共通利用するモック
    mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    // イベント発行用ユーザーモック
    mockTx.user.findUnique.mockResolvedValue({ id: TEST_USER_ID, name: 'User' });
  });

  describe('getPreconditions', () => {
    it('前提条件一覧を取得できる', async () => {
      const mockItems = [
        { id: 'p1', content: '前提1', orderKey: '00001' },
        { id: 'p2', content: '前提2', orderKey: '00002' },
      ];
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue(mockItems);

      const result = await service.getPreconditions(TEST_CASE_ID);

      expect(result).toEqual(mockItems);
      expect(mockPrisma.testCasePrecondition.findMany).toHaveBeenCalledWith({
        where: { testCaseId: TEST_CASE_ID },
        orderBy: { orderKey: 'asc' },
      });
    });

    it('テストケースが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findById.mockResolvedValue(null);

      await expect(service.getPreconditions(TEST_CASE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('addPrecondition', () => {
    it('前提条件を追加できる', async () => {
      const mockCreated = { id: PRECONDITION_ID, content: '新しい前提', orderKey: '00001', testCaseId: TEST_CASE_ID };
      mockTx.testCasePrecondition.findFirst.mockResolvedValue(null);
      mockTx.testCasePrecondition.create.mockResolvedValue(mockCreated);

      const result = await service.addPrecondition(TEST_CASE_ID, TEST_USER_ID, { content: '新しい前提' });

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('既存の前提条件がある場合はorderKeyを自動計算する', async () => {
      mockTx.testCasePrecondition.findFirst.mockResolvedValue({ orderKey: '00003' });
      mockTx.testCasePrecondition.create.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '追加',
        orderKey: '00004',
      });

      await service.addPrecondition(TEST_CASE_ID, TEST_USER_ID, { content: '追加' });

      expect(mockTx.testCasePrecondition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderKey: '00004' }),
      });
    });

    it('orderKeyを明示的に指定できる', async () => {
      mockTx.testCasePrecondition.create.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '前提',
        orderKey: '00010',
      });

      await service.addPrecondition(TEST_CASE_ID, TEST_USER_ID, { content: '前提', orderKey: '00010' });

      expect(mockTx.testCasePrecondition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderKey: '00010' }),
      });
    });

    it('履歴を記録する', async () => {
      mockTx.testCasePrecondition.findFirst.mockResolvedValue(null);
      mockTx.testCasePrecondition.create.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '前提',
        orderKey: '00001',
      });

      await service.addPrecondition(TEST_CASE_ID, TEST_USER_ID, { content: '前提' });

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testCaseId: TEST_CASE_ID,
          changedByUserId: TEST_USER_ID,
          changeType: 'UPDATE',
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_ADD',
            }),
          }),
        }),
      });
    });

    it('groupIdを指定できる', async () => {
      mockTx.testCasePrecondition.findFirst.mockResolvedValue(null);
      mockTx.testCasePrecondition.create.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '前提',
        orderKey: '00001',
      });

      await service.addPrecondition(TEST_CASE_ID, TEST_USER_ID, { content: '前提' }, 'custom-group');

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ groupId: 'custom-group' }),
      });
    });

    it('テストケースが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findById.mockResolvedValue(null);

      await expect(
        service.addPrecondition(TEST_CASE_ID, TEST_USER_ID, { content: '前提' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('updatePrecondition', () => {
    it('前提条件を更新できる', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '旧内容',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCasePrecondition.update.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '新内容',
        orderKey: '00001',
      });

      const result = await service.updatePrecondition(
        TEST_CASE_ID,
        PRECONDITION_ID,
        TEST_USER_ID,
        { content: '新内容' }
      );

      expect(result).toEqual(expect.objectContaining({ content: '新内容' }));
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('変更差分を履歴に記録する', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '旧内容',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCasePrecondition.update.mockResolvedValue({});

      await service.updatePrecondition(TEST_CASE_ID, PRECONDITION_ID, TEST_USER_ID, { content: '新内容' });

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_UPDATE',
              before: { content: '旧内容' },
              after: { content: '新内容' },
            }),
          }),
        }),
      });
    });

    it('同じ内容の場合は更新をスキップする', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '同じ内容',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });

      const result = await service.updatePrecondition(
        TEST_CASE_ID,
        PRECONDITION_ID,
        TEST_USER_ID,
        { content: '同じ内容' }
      );

      expect(result.content).toBe('同じ内容');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('前提条件が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePrecondition(TEST_CASE_ID, PRECONDITION_ID, TEST_USER_ID, { content: '更新' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deletePrecondition', () => {
    it('前提条件を削除できる', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '削除対象',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCasePrecondition.findMany.mockResolvedValue([]);

      await service.deletePrecondition(TEST_CASE_ID, PRECONDITION_ID, TEST_USER_ID);

      expect(mockTx.testCasePrecondition.delete).toHaveBeenCalledWith({
        where: { id: PRECONDITION_ID },
      });
    });

    it('DELETE履歴を記録する', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '削除',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCasePrecondition.findMany.mockResolvedValue([]);

      await service.deletePrecondition(TEST_CASE_ID, PRECONDITION_ID, TEST_USER_ID);

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_DELETE',
              preconditionId: PRECONDITION_ID,
            }),
          }),
        }),
      });
    });

    it('削除後に残りのorderKeyを再整列する', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue({
        id: PRECONDITION_ID,
        content: '削除',
        orderKey: '00002',
        testCaseId: TEST_CASE_ID,
      });
      const remaining = [
        { id: 'p1', content: '残1', orderKey: '00001' },
        { id: 'p3', content: '残2', orderKey: '00003' },
      ];
      mockTx.testCasePrecondition.findMany.mockResolvedValue(remaining);

      await service.deletePrecondition(TEST_CASE_ID, PRECONDITION_ID, TEST_USER_ID);

      // 再整列: p1→00001, p3→00002
      expect(mockTx.testCasePrecondition.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { orderKey: '00001' },
      });
      expect(mockTx.testCasePrecondition.update).toHaveBeenCalledWith({
        where: { id: 'p3' },
        data: { orderKey: '00002' },
      });
    });

    it('前提条件が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePrecondition(TEST_CASE_ID, PRECONDITION_ID, TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('reorderPreconditions', () => {
    it('前提条件を並び替えできる', async () => {
      const existing = [
        { id: 'p1', content: '前提1', orderKey: '00001' },
        { id: 'p2', content: '前提2', orderKey: '00002' },
      ];
      mockPrisma.testCasePrecondition.findMany
        .mockResolvedValueOnce(existing) // 既存取得
        .mockResolvedValueOnce([         // 更新後取得
          { id: 'p2', content: '前提2', orderKey: '00001' },
          { id: 'p1', content: '前提1', orderKey: '00002' },
        ]);

      const result = await service.reorderPreconditions(TEST_CASE_ID, ['p2', 'p1'], TEST_USER_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('REORDER履歴を記録する', async () => {
      const existing = [
        { id: 'p1', content: '前提1', orderKey: '00001' },
        { id: 'p2', content: '前提2', orderKey: '00002' },
      ];
      mockPrisma.testCasePrecondition.findMany
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([]);

      await service.reorderPreconditions(TEST_CASE_ID, ['p2', 'p1'], TEST_USER_ID);

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_REORDER',
              before: ['p1', 'p2'],
              after: ['p2', 'p1'],
            }),
          }),
        }),
      });
    });

    it('順序が同じ場合は更新をスキップする', async () => {
      const existing = [
        { id: 'p1', content: '前提1', orderKey: '00001' },
        { id: 'p2', content: '前提2', orderKey: '00002' },
      ];
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue(existing);

      const result = await service.reorderPreconditions(TEST_CASE_ID, ['p1', 'p2'], TEST_USER_ID);

      expect(result).toEqual(existing);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('空配列の場合は空配列を返す', async () => {
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue([]);

      const result = await service.reorderPreconditions(TEST_CASE_ID, [], TEST_USER_ID);

      expect(result).toEqual([]);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('重複IDの場合はBadRequestErrorを投げる', async () => {
      const existing = [
        { id: 'p1', content: '前提1', orderKey: '00001' },
        { id: 'p2', content: '前提2', orderKey: '00002' },
      ];
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue(existing);

      await expect(
        service.reorderPreconditions(TEST_CASE_ID, ['p1', 'p1'], TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('件数が一致しない場合はBadRequestErrorを投げる', async () => {
      const existing = [
        { id: 'p1', content: '前提1', orderKey: '00001' },
        { id: 'p2', content: '前提2', orderKey: '00002' },
      ];
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue(existing);

      await expect(
        service.reorderPreconditions(TEST_CASE_ID, ['p1'], TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('存在しないIDの場合はNotFoundErrorを投げる', async () => {
      const existing = [
        { id: 'p1', content: '前提1', orderKey: '00001' },
        { id: 'p2', content: '前提2', orderKey: '00002' },
      ];
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue(existing);

      await expect(
        service.reorderPreconditions(TEST_CASE_ID, ['p1', 'p-unknown'], TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
