import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, BadRequestError } from '@agentest/shared';

// トランザクション内モック
const mockTx = vi.hoisted(() => ({
  testCasePrecondition: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseStep: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseExpectedResult: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseHistory: { create: vi.fn() },
  testCase: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
}));

const mockPrisma = vi.hoisted(() => ({
  testCasePrecondition: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseStep: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseExpectedResult: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseHistory: { create: vi.fn() },
  testCase: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn((fn: any) => fn(mockTx)),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

// TestCaseRepositoryモック
const mockTestCaseRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
}));

vi.mock('../../repositories/test-case.repository.js', () => ({
  TestCaseRepository: vi.fn().mockImplementation(() => mockTestCaseRepo),
}));

// redis-publisherモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishDashboardUpdated: vi.fn(),
}));

// eventsモック
vi.mock('../../lib/events.js', () => ({
  publishTestCaseUpdated: vi.fn(),
}));

import { TestCaseService } from '../../services/test-case.service.js';

// テスト用固定ID
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_CASE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_SUITE_ID = '33333333-3333-3333-3333-333333333333';
const TEST_PROJECT_ID = '44444444-4444-4444-4444-444444444444';
const STEP_ID = '66666666-6666-6666-6666-666666666666';

// テスト用テストケースモック
const createMockTestCase = (overrides = {}) => ({
  id: TEST_CASE_ID,
  testSuiteId: TEST_SUITE_ID,
  title: 'テストケース',
  description: 'テスト説明',
  priority: 'MEDIUM',
  status: 'DRAFT',
  orderKey: '00001',
  deletedAt: null,
  testSuite: { id: TEST_SUITE_ID, name: 'スイート', projectId: TEST_PROJECT_ID },
  createdByUser: { id: TEST_USER_ID, name: 'User', avatarUrl: null },
  preconditions: [],
  steps: [],
  expectedResults: [],
  ...overrides,
});

describe('TestCaseService（ステップCRUD）', () => {
  let service: TestCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
    // findByIdで共通利用するモック
    mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    // イベント発行用ユーザーモック
    mockTx.user.findUnique.mockResolvedValue({ id: TEST_USER_ID, name: 'User' });
  });

  describe('getSteps', () => {
    it('ステップ一覧を取得できる', async () => {
      const mockItems = [
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
      ];
      mockPrisma.testCaseStep.findMany.mockResolvedValue(mockItems);

      const result = await service.getSteps(TEST_CASE_ID);

      expect(result).toEqual(mockItems);
      expect(mockPrisma.testCaseStep.findMany).toHaveBeenCalledWith({
        where: { testCaseId: TEST_CASE_ID },
        orderBy: { orderKey: 'asc' },
      });
    });

    it('テストケースが存在しない場合はNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findById.mockResolvedValue(null);

      await expect(service.getSteps(TEST_CASE_ID)).rejects.toThrow(NotFoundError);
    });
  });

  describe('addStep', () => {
    it('ステップを追加できる', async () => {
      const mockCreated = { id: STEP_ID, content: '新ステップ', orderKey: '00001', testCaseId: TEST_CASE_ID };
      mockTx.testCaseStep.findFirst.mockResolvedValue(null);
      mockTx.testCaseStep.create.mockResolvedValue(mockCreated);

      const result = await service.addStep(TEST_CASE_ID, TEST_USER_ID, { content: '新ステップ' });

      expect(result).toEqual(mockCreated);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('既存ステップがある場合はorderKeyを自動計算する', async () => {
      mockTx.testCaseStep.findFirst.mockResolvedValue({ orderKey: '00005' });
      mockTx.testCaseStep.create.mockResolvedValue({ id: STEP_ID, content: 'ステップ', orderKey: '00006' });

      await service.addStep(TEST_CASE_ID, TEST_USER_ID, { content: 'ステップ' });

      expect(mockTx.testCaseStep.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ orderKey: '00006' }),
      });
    });

    it('STEP_ADD履歴を記録する', async () => {
      mockTx.testCaseStep.findFirst.mockResolvedValue(null);
      mockTx.testCaseStep.create.mockResolvedValue({ id: STEP_ID, content: 'ステップ', orderKey: '00001' });

      await service.addStep(TEST_CASE_ID, TEST_USER_ID, { content: 'ステップ' });

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({ type: 'STEP_ADD' }),
          }),
        }),
      });
    });
  });

  describe('updateStep', () => {
    it('ステップを更新できる', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        content: '旧ステップ',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseStep.update.mockResolvedValue({ id: STEP_ID, content: '新ステップ', orderKey: '00001' });

      const result = await service.updateStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID, { content: '新ステップ' });

      expect(result).toEqual(expect.objectContaining({ content: '新ステップ' }));
    });

    it('STEP_UPDATE履歴を記録する', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        content: '旧',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseStep.update.mockResolvedValue({});

      await service.updateStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID, { content: '新' });

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'STEP_UPDATE',
              before: { content: '旧' },
              after: { content: '新' },
            }),
          }),
        }),
      });
    });

    it('同じ内容の場合は更新をスキップする', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        content: '同じ',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });

      const result = await service.updateStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID, { content: '同じ' });

      expect(result.content).toBe('同じ');
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('ステップが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID, { content: '更新' })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('deleteStep', () => {
    it('ステップを削除できる', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        content: '削除対象',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseStep.findMany.mockResolvedValue([]);

      await service.deleteStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID);

      expect(mockTx.testCaseStep.delete).toHaveBeenCalledWith({ where: { id: STEP_ID } });
    });

    it('STEP_DELETE履歴を記録する', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        content: '削除',
        orderKey: '00001',
        testCaseId: TEST_CASE_ID,
      });
      mockTx.testCaseStep.findMany.mockResolvedValue([]);

      await service.deleteStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID);

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'STEP_DELETE',
              stepId: STEP_ID,
            }),
          }),
        }),
      });
    });

    it('削除後に残りのorderKeyを再整列する', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue({
        id: STEP_ID,
        content: '削除',
        orderKey: '00002',
        testCaseId: TEST_CASE_ID,
      });
      const remaining = [
        { id: 's1', content: '残1', orderKey: '00001' },
        { id: 's3', content: '残2', orderKey: '00003' },
      ];
      mockTx.testCaseStep.findMany.mockResolvedValue(remaining);

      await service.deleteStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID);

      expect(mockTx.testCaseStep.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { orderKey: '00001' },
      });
      expect(mockTx.testCaseStep.update).toHaveBeenCalledWith({
        where: { id: 's3' },
        data: { orderKey: '00002' },
      });
    });

    it('ステップが存在しない場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCaseStep.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteStep(TEST_CASE_ID, STEP_ID, TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('reorderSteps', () => {
    it('ステップを並び替えできる', async () => {
      const existing = [
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
        { id: 's2', content: 'ステップ2', orderKey: '00002' },
      ];
      mockPrisma.testCaseStep.findMany
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([
          { id: 's2', content: 'ステップ2', orderKey: '00001' },
          { id: 's1', content: 'ステップ1', orderKey: '00002' },
        ]);

      const result = await service.reorderSteps(TEST_CASE_ID, ['s2', 's1'], TEST_USER_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('STEP_REORDER履歴を記録する', async () => {
      const existing = [
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
        { id: 's2', content: 'ステップ2', orderKey: '00002' },
      ];
      mockPrisma.testCaseStep.findMany
        .mockResolvedValueOnce(existing)
        .mockResolvedValueOnce([]);

      await service.reorderSteps(TEST_CASE_ID, ['s2', 's1'], TEST_USER_ID);

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'STEP_REORDER',
              before: ['s1', 's2'],
              after: ['s2', 's1'],
            }),
          }),
        }),
      });
    });

    it('順序が同じ場合は更新をスキップする', async () => {
      const existing = [
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
      ];
      mockPrisma.testCaseStep.findMany.mockResolvedValue(existing);

      const result = await service.reorderSteps(TEST_CASE_ID, ['s1'], TEST_USER_ID);

      expect(result).toEqual(existing);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('重複IDの場合はBadRequestErrorを投げる', async () => {
      mockPrisma.testCaseStep.findMany.mockResolvedValue([
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
        { id: 's2', content: 'ステップ2', orderKey: '00002' },
      ]);

      await expect(
        service.reorderSteps(TEST_CASE_ID, ['s1', 's1'], TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('件数不一致の場合はBadRequestErrorを投げる', async () => {
      mockPrisma.testCaseStep.findMany.mockResolvedValue([
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
        { id: 's2', content: 'ステップ2', orderKey: '00002' },
      ]);

      await expect(
        service.reorderSteps(TEST_CASE_ID, ['s1'], TEST_USER_ID)
      ).rejects.toThrow(BadRequestError);
    });

    it('存在しないIDの場合はNotFoundErrorを投げる', async () => {
      mockPrisma.testCaseStep.findMany.mockResolvedValue([
        { id: 's1', content: 'ステップ1', orderKey: '00001' },
      ]);

      await expect(
        service.reorderSteps(TEST_CASE_ID, ['s-unknown'], TEST_USER_ID)
      ).rejects.toThrow(NotFoundError);
    });
  });
});
