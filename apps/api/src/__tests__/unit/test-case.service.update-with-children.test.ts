import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestError } from '@agentest/shared';

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
import { TEST_USER_ID, TEST_CASE_ID, TEST_SUITE_ID, TEST_PROJECT_ID, createMockTestCase } from './test-case.service.test-helpers.js';

describe('TestCaseService（updateWithChildren差分同期）', () => {
  let service: TestCaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
    // findByIdで共通利用するモック
    mockTestCaseRepo.findById.mockResolvedValue(createMockTestCase());
    // イベント発行用ユーザーモック
    mockTx.user.findUnique.mockResolvedValue({ id: TEST_USER_ID, name: 'User' });
  });

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
