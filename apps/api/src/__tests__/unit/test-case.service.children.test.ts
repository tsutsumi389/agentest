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
const PRECONDITION_ID = '55555555-5555-5555-5555-555555555555';
const STEP_ID = '66666666-6666-6666-6666-666666666666';
const EXPECTED_RESULT_ID = '77777777-7777-7777-7777-777777777777';

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

describe('TestCaseService（子エンティティCRUD）', () => {
  let service: TestCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
    // findByIdで共通利用するモック
    mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    // イベント発行用ユーザーモック
    mockTx.user.findUnique.mockResolvedValue({ id: TEST_USER_ID, name: 'User' });
  });

  // ===========================================
  // 前提条件（Precondition）
  // ===========================================
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

  // ===========================================
  // ステップ（Step）
  // ===========================================
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

  // ===========================================
  // 期待結果（ExpectedResult）
  // ===========================================
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

  // ===========================================
  // updateWithChildren（差分同期）
  // ===========================================
  describe('updateWithChildren', () => {
    beforeEach(() => {
      // 既存の子エンティティを返すモック
      mockTx.testCasePrecondition.findMany.mockResolvedValue([]);
      mockTx.testCaseStep.findMany.mockResolvedValue([]);
      mockTx.testCaseExpectedResult.findMany.mockResolvedValue([]);
      mockTx.testCase.findUnique.mockResolvedValue(createMockTestCase());
    });

    it('基本情報のみ更新できる', async () => {
      mockTx.testCase.update.mockResolvedValue({});

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, { title: '新タイトル' });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'BASIC_INFO_UPDATE',
              fields: expect.objectContaining({
                title: { before: 'テストケース', after: '新タイトル' },
              }),
            }),
          }),
        }),
      });
    });

    it('基本情報に変更がない場合は履歴を作成しない', async () => {
      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, { title: 'テストケース' });

      expect(mockTx.testCase.update).not.toHaveBeenCalled();
    });

    it('新しい子エンティティを作成できる', async () => {
      const mockCreated = { id: 'new-p1', content: '新前提', orderKey: '00001' };
      mockTx.testCasePrecondition.create.mockResolvedValue(mockCreated);

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, {
        preconditions: [{ content: '新前提' }],
      });

      expect(mockTx.testCasePrecondition.create).toHaveBeenCalledWith({
        data: { testCaseId: TEST_CASE_ID, content: '新前提', orderKey: '00001' },
      });
      // PRECONDITION_ADD履歴
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({ type: 'PRECONDITION_ADD' }),
          }),
        }),
      });
    });

    it('既存の子エンティティを更新できる', async () => {
      mockTx.testCasePrecondition.findMany.mockResolvedValue([
        { id: 'p1', content: '旧前提', orderKey: '00001' },
      ]);

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, {
        preconditions: [{ id: 'p1', content: '更新前提' }],
      });

      expect(mockTx.testCasePrecondition.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { content: '更新前提', orderKey: '00001' },
      });
      // PRECONDITION_UPDATE履歴
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_UPDATE',
              before: { content: '旧前提' },
              after: { content: '更新前提' },
            }),
          }),
        }),
      });
    });

    it('既存の子エンティティと同じ内容の場合は履歴を作成しない', async () => {
      mockTx.testCasePrecondition.findMany.mockResolvedValue([
        { id: 'p1', content: '同じ内容', orderKey: '00001' },
      ]);

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, {
        preconditions: [{ id: 'p1', content: '同じ内容' }],
      });

      // 更新は行う（orderKeyの再計算のため）がPRECONDITION_UPDATE履歴は作成しない
      expect(mockTx.testCasePrecondition.update).toHaveBeenCalled();
      // PRECONDITION_UPDATE型の履歴が作成されていないことを確認
      const historyCalls = mockTx.testCaseHistory.create.mock.calls;
      const hasUpdateHistory = historyCalls.some(
        (call: any) => call[0]?.data?.snapshot?.changeDetail?.type === 'PRECONDITION_UPDATE'
      );
      expect(hasUpdateHistory).toBe(false);
    });

    it('リクエストにないIDの子エンティティを削除できる', async () => {
      mockTx.testCasePrecondition.findMany.mockResolvedValue([
        { id: 'p1', content: '削除対象', orderKey: '00001' },
      ]);

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, {
        preconditions: [], // 空配列 = 全削除
      });

      expect(mockTx.testCasePrecondition.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
      // PRECONDITION_DELETE履歴
      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            changeDetail: expect.objectContaining({
              type: 'PRECONDITION_DELETE',
              preconditionId: 'p1',
            }),
          }),
        }),
      });
    });

    it('ステップの差分同期が動作する', async () => {
      mockTx.testCaseStep.findMany.mockResolvedValue([
        { id: 's1', content: '旧ステップ', orderKey: '00001' },
      ]);
      mockTx.testCaseStep.create.mockResolvedValue({ id: 's-new', content: '新ステップ', orderKey: '00002' });

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, {
        steps: [
          { id: 's1', content: '更新ステップ' },
          { content: '新ステップ' },
        ],
      });

      // s1は更新
      expect(mockTx.testCaseStep.update).toHaveBeenCalled();
      // 新規作成
      expect(mockTx.testCaseStep.create).toHaveBeenCalled();
    });

    it('期待結果の差分同期が動作する', async () => {
      mockTx.testCaseExpectedResult.findMany.mockResolvedValue([
        { id: 'e1', content: '旧期待結果', orderKey: '00001' },
        { id: 'e2', content: '削除対象', orderKey: '00002' },
      ]);

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, {
        expectedResults: [{ id: 'e1', content: '更新期待結果' }], // e2は削除
      });

      // e2は削除
      expect(mockTx.testCaseExpectedResult.delete).toHaveBeenCalledWith({ where: { id: 'e2' } });
      // e1は更新
      expect(mockTx.testCaseExpectedResult.update).toHaveBeenCalled();
    });

    it('存在しないIDを指定した場合はBadRequestErrorを投げる', async () => {
      mockTx.testCasePrecondition.findMany.mockResolvedValue([]);

      await expect(
        service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, {
          preconditions: [{ id: 'non-existent', content: '不正' }],
        })
      ).rejects.toThrow(BadRequestError);
    });

    it('groupIdを指定できる', async () => {
      mockTx.testCase.update.mockResolvedValue({});

      await service.updateWithChildren(TEST_CASE_ID, TEST_USER_ID, { title: '変更' }, 'custom-group');

      expect(mockTx.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ groupId: 'custom-group' }),
      });
    });
  });
});
