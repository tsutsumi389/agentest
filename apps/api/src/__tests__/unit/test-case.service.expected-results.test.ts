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
import { TEST_USER_ID, TEST_CASE_ID, EXPECTED_RESULT_ID, createMockTestCase } from './test-case.service.test-helpers.js';

describe('TestCaseService（期待結果CRUD）', () => {
  let service: TestCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
    // findByIdで共通利用するモック
    mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    // イベント発行用ユーザーモック
    mockTx.user.findUnique.mockResolvedValue({ id: TEST_USER_ID, name: 'User' });
  });

  describe('getExpectedResults', () => {
    it('期待結果一覧を取得できる', async () => {
      const mockItems = [
        { id: 'e1', content: '期待結果1', orderKey: '00001' },
      ];
      mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue(mockItems);

      const result = await service.getExpectedResults(TEST_CASE_ID);

      expect(result).toEqual(mockItems);
      expect(mockPrisma.testCaseExpectedResult.findMany).toHaveBeenCalledWith({
        where: { testCaseId: TEST_CASE_ID },
        orderBy: { orderKey: 'asc' },
      });
    });

    it('テストケースが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findById.mockResolvedValue(null);

      await expect(service.getExpectedResults(TEST_CASE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('addExpectedResult', () => {
    it('期待結果を追加できる', async () => {
      const mockCreated = { id: EXPECTED_RESULT_ID, content: '新しい期待結果', orderKey: '00001', testCaseId: TEST_CASE_ID };
      mockTx.testCaseExpectedResult.findFirst.mockResolvedValue(null);
      mockTx.testCaseExpectedResult.create.mockResolvedValue(mockCreated);

      const result = await service.addExpectedResult(TEST_CASE_ID, TEST_USER_ID, { content: '新しい期待結果' });

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('既存の期待結果がある場合はorderKeyを自動計算する', async () => {
      mockTx.testCaseExpectedResult.findFirst.mockResolvedValue({ orderKey: '00002' });
      mockTx.testCaseExpectedResult.create.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '期待結果',
        orderKey: '00003',
      });

      await service.addExpectedResult(TEST_CASE_ID, TEST_USER_ID, { content: '期待結果' });

      expect(mockTx.testCaseExpectedResult.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderKey: '00003' }),
      });
    });

    it('EXPECTED_RESULT_ADD履歴を記録する', async () => {
      mockTx.testCaseExpectedResult.findFirst.mockResolvedValue(null);
      mockTx.testCaseExpectedResult.create.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '期待結果',
        orderKey: '00001',
      });

      await service.addExpectedResult(TEST_CASE_ID, TEST_USER_ID, { content: '期待結果' });

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({ type: 'EXPECTED_RESULT_ADD' }),
          }),
        }),
      });
    });
  });

  describe('updateExpectedResult', () => {
    it('期待結果を更新できる', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '旧期待結果',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseExpectedResult.update.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '新期待結果',
        orderKey: '00001',
      });

      const result = await service.updateExpectedResult(
        TEST_CASE_ID,
        EXPECTED_RESULT_ID,
        TEST_USER_ID,
        { content: '新期待結果' }
      );

      expect(result).toEqual(expect.objectContaining({ content: '新期待結果' }));
    });

    it('EXPECTED_RESULT_UPDATE履歴を記録する', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '旧',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseExpectedResult.update.mockResolvedValue({});

      await service.updateExpectedResult(TEST_CASE_ID, EXPECTED_RESULT_ID, TEST_USER_ID, { content: '新' });

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'EXPECTED_RESULT_UPDATE',
              before: { content: '旧' },
              after: { content: '新' },
            }),
          }),
        }),
      });
    });

    it('同じ内容の場合は更新をスキップする', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '同じ内容',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });

      const result = await service.updateExpectedResult(
        TEST_CASE_ID,
        EXPECTED_RESULT_ID,
        TEST_USER_ID,
        { content: '同じ内容' }
      );

      expect(result.content).toBe('同じ内容');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('期待結果が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue(null);

      await expect(
        service.updateExpectedResult(TEST_CASE_ID, EXPECTED_RESULT_ID, TEST_USER_ID, { content: '更新' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteExpectedResult', () => {
    it('期待結果を削除できる', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '削除対象',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseExpectedResult.findMany.mockResolvedValue([]);

      await service.deleteExpectedResult(TEST_CASE_ID, EXPECTED_RESULT_ID, TEST_USER_ID);

      expect(mockTx.testCaseExpectedResult.delete).toHaveBeenCalledWith({ where: { id: EXPECTED_RESULT_ID } });
    });

    it('EXPECTED_RESULT_DELETE履歴を記録する', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '削除',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseExpectedResult.findMany.mockResolvedValue([]);

      await service.deleteExpectedResult(TEST_CASE_ID, EXPECTED_RESULT_ID, TEST_USER_ID);

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'EXPECTED_RESULT_DELETE',
              expectedResultId: EXPECTED_RESULT_ID,
            }),
          }),
        }),
      });
    });

    it('削除後に残りのorderKeyを再整列する', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue({
        id: EXPECTED_RESULT_ID,
        content: '削除',
        orderKey: '00002',
        testCaseId: TEST_CASE_ID,
      });
      const remaining = [
        { id: 'e1', content: '残1', orderKey: '00001' },
        { id: 'e3', content: '残2', orderKey: '00003' },
      ];
      mockTx.testCaseExpectedResult.findMany.mockResolvedValue(remaining);

      await service.deleteExpectedResult(TEST_CASE_ID, EXPECTED_RESULT_ID, TEST_USER_ID);

      expect(mockTx.testCaseExpectedResult.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { orderKey: '00001' },
      });
      expect(mockTx.testCaseExpectedResult.update).toHaveBeenCalledWith({
        where: { id: 'e3' },
        data: { orderKey: '00002' },
      });
    });

    it('期待結果が存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteExpectedResult(TEST_CASE_ID, EXPECTED_RESULT_ID, TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('reorderExpectedResults', () => {
    it('期待結果を並び替えできる', async () => {
      const existing = [
        { id: 'e1', content: '期待結果1', orderKey: '00001' },
        { id: 'e2', content: '期待結果2', orderKey: '00002' },
      ];
      mockPrisma.testCaseExpectedResult.findMany
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([
          { id: 'e2', content: '期待結果2', orderKey: '00001' },
          { id: 'e1', content: '期待結果1', orderKey: '00002' },
        ]);

      const result = await service.reorderExpectedResults(TEST_CASE_ID, ['e2', 'e1'], TEST_USER_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('EXPECTED_RESULT_REORDER履歴を記録する', async () => {
      const existing = [
        { id: 'e1', content: '期待結果1', orderKey: '00001' },
        { id: 'e2', content: '期待結果2', orderKey: '00002' },
      ];
      mockPrisma.testCaseExpectedResult.findMany
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([]);

      await service.reorderExpectedResults(TEST_CASE_ID, ['e2', 'e1'], TEST_USER_ID);

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'EXPECTED_RESULT_REORDER',
              before: ['e1', 'e2'],
              after: ['e2', 'e1'],
            }),
          }),
        }),
      });
    });

    it('順序が同じ場合は更新をスキップする', async () => {
      const existing = [
        { id: 'e1', content: '期待結果1', orderKey: '00001' },
      ];
      mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue(existing);

      const result = await service.reorderExpectedResults(TEST_CASE_ID, ['e1'], TEST_USER_ID);

      expect(result).toEqual(existing);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('重複IDの場合はBadRequestErrorを投げる', async () => {
      mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue([
        { id: 'e1', content: '期待結果1', orderKey: '00001' },
        { id: 'e2', content: '期待結果2', orderKey: '00002' },
      ]);

      await expect(
        service.reorderExpectedResults(TEST_CASE_ID, ['e1', 'e1'], TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('件数不一致の場合はBadRequestErrorを投げる', async () => {
      mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue([
        { id: 'e1', content: '期待結果1', orderKey: '00001' },
        { id: 'e2', content: '期待結果2', orderKey: '00002' },
      ]);

      await expect(
        service.reorderExpectedResults(TEST_CASE_ID, ['e1'], TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('存在しないIDの場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue([
        { id: 'e1', content: '期待結果1', orderKey: '00001' },
      ]);

      await expect(
        service.reorderExpectedResults(TEST_CASE_ID, ['e-unknown'], TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
