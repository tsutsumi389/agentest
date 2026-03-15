import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ConflictError, BadRequestError } from '@agentest/shared';

// TestCaseRepository のモック
const mockTestCaseRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findDeletedById: vi.fn(),
  getHistories: vi.fn(),
  countHistories: vi.fn(),
  restore: vi.fn(),
}));

vi.mock('../../repositories/test-case.repository.js', () => ({
  TestCaseRepository: vi.fn().mockImplementation(() => mockTestCaseRepo),
}));

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  testCase: {
    findUnique: vi.fn(),
  },
  testSuite: {
    findUnique: vi.fn(),
  },
  testCaseHistory: {
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

import { TestCaseService } from '../../services/test-case.service.js';

describe('TestCaseService - History & Restore', () => {
  let service: TestCaseService;

  const mockTestCase = {
    id: 'test-case-1',
    testSuiteId: 'test-suite-1',
    title: 'Test Case',
    description: 'Test Description',
    priority: 'MEDIUM',
    status: 'DRAFT',
    orderKey: '00001',
    createdByUserId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockDeletedTestCase = {
    ...mockTestCase,
    deletedAt: new Date(),
  };

  const mockTestSuite = {
    id: 'test-suite-1',
    projectId: 'project-1',
    name: 'Test Suite',
    deletedAt: null,
  };

  const mockDeletedTestSuite = {
    ...mockTestSuite,
    deletedAt: new Date(),
  };

  const mockHistory = {
    id: 'history-1',
    testCaseId: 'test-case-1',
    changedByUserId: 'user-1',
    changedByAgentSessionId: null,
    changeType: 'UPDATE' as const,
    snapshot: { title: 'Test Case' },
    createdAt: new Date(),
    changedBy: {
      id: 'user-1',
      name: 'Test User',
      avatarUrl: null,
    },
    agentSession: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
  });

  // ============================================================
  // getHistories
  // ============================================================
  describe('getHistories', () => {
    const mockHistories = [
      { ...mockHistory, changeType: 'UPDATE' },
      { ...mockHistory, id: 'history-2', changeType: 'CREATE' },
    ];

    it('履歴一覧を取得できる', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockTestCaseRepo.getHistories.mockResolvedValue(mockHistories);
      mockTestCaseRepo.countHistories.mockResolvedValue(2);

      const result = await service.getHistories('test-case-1', { limit: 20, offset: 0 });

      expect(mockPrisma.testCase.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-case-1' },
      });
      expect(mockTestCaseRepo.getHistories).toHaveBeenCalledWith('test-case-1', {
        limit: 20,
        offset: 0,
      });
      expect(mockTestCaseRepo.countHistories).toHaveBeenCalledWith('test-case-1');
      expect(result.histories).toEqual(mockHistories);
      expect(result.total).toBe(2);
    });

    it('limitとoffsetを指定して履歴を取得できる', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockTestCaseRepo.getHistories.mockResolvedValue([mockHistories[0]]);
      mockTestCaseRepo.countHistories.mockResolvedValue(10);

      const result = await service.getHistories('test-case-1', { limit: 1, offset: 5 });

      expect(mockTestCaseRepo.getHistories).toHaveBeenCalledWith('test-case-1', {
        limit: 1,
        offset: 5,
      });
      expect(result.histories).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it('削除済みテストケースでも履歴を取得できる', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockDeletedTestCase);
      mockTestCaseRepo.getHistories.mockResolvedValue(mockHistories);
      mockTestCaseRepo.countHistories.mockResolvedValue(2);

      const result = await service.getHistories('test-case-1', { limit: 20, offset: 0 });

      expect(result.histories).toEqual(mockHistories);
      expect(result.total).toBe(2);
    });

    it('履歴が0件の場合、空配列と0を返す', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockTestCaseRepo.getHistories.mockResolvedValue([]);
      mockTestCaseRepo.countHistories.mockResolvedValue(0);

      const result = await service.getHistories('test-case-1', { limit: 20, offset: 0 });

      expect(result.histories).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('存在しないテストケースはNotFoundErrorを投げる', async () => {
      mockPrisma.testCase.findUnique.mockResolvedValue(null);

      await expect(service.getHistories('invalid-case', { limit: 20, offset: 0 })).rejects.toThrow(
        NotFoundError
      );
    });

    it('履歴にユーザー情報が含まれる', async () => {
      const historyWithUser = {
        ...mockHistory,
        changedBy: { id: 'user-1', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      };
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockTestCaseRepo.getHistories.mockResolvedValue([historyWithUser]);
      mockTestCaseRepo.countHistories.mockResolvedValue(1);

      const result = await service.getHistories('test-case-1', { limit: 20, offset: 0 });

      expect(result.histories[0].changedBy).toEqual({
        id: 'user-1',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      });
    });

    it('履歴にAgentSession情報が含まれる', async () => {
      const historyWithAgent = {
        ...mockHistory,
        changedByUserId: null,
        changedByAgentSessionId: 'agent-session-1',
        changedBy: null,
        agentSession: { id: 'agent-session-1', clientName: 'Claude Code' },
      };
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase);
      mockTestCaseRepo.getHistories.mockResolvedValue([historyWithAgent]);
      mockTestCaseRepo.countHistories.mockResolvedValue(1);

      const result = await service.getHistories('test-case-1', { limit: 20, offset: 0 });

      expect(result.histories[0].agentSession).toEqual({
        id: 'agent-session-1',
        clientName: 'Claude Code',
      });
    });
  });

  // ============================================================
  // restore
  // ============================================================
  describe('restore', () => {
    const restoredTestCase = {
      ...mockTestCase,
      deletedAt: null,
    };

    it('削除済みテストケースを復元できる', async () => {
      mockTestCaseRepo.findDeletedById.mockResolvedValue(mockDeletedTestCase);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testCaseHistory.create.mockResolvedValue(mockHistory);
      mockTestCaseRepo.restore.mockResolvedValue(restoredTestCase);

      const result = await service.restore('test-case-1', 'user-1');

      expect(mockTestCaseRepo.findDeletedById).toHaveBeenCalledWith('test-case-1');
      expect(result.deletedAt).toBeNull();
    });

    it('復元時に履歴が作成される', async () => {
      mockTestCaseRepo.findDeletedById.mockResolvedValue(mockDeletedTestCase);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testCaseHistory.create.mockResolvedValue(mockHistory);
      mockTestCaseRepo.restore.mockResolvedValue(restoredTestCase);

      await service.restore('test-case-1', 'user-1');

      expect(mockPrisma.testCaseHistory.create).toHaveBeenCalledWith({
        data: {
          testCaseId: 'test-case-1',
          changedByUserId: 'user-1',
          changeType: 'RESTORE',
          groupId: expect.any(String),
          snapshot: expect.objectContaining({
            id: mockDeletedTestCase.id,
            testSuiteId: mockDeletedTestCase.testSuiteId,
            title: mockDeletedTestCase.title,
            description: mockDeletedTestCase.description,
            priority: mockDeletedTestCase.priority,
            status: mockDeletedTestCase.status,
            deletedAt: expect.any(String),
          }),
        },
      });
    });

    it('復元がトランザクション内で実行される', async () => {
      mockTestCaseRepo.findDeletedById.mockResolvedValue(mockDeletedTestCase);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testCaseHistory.create.mockResolvedValue(mockHistory);
      mockTestCaseRepo.restore.mockResolvedValue(restoredTestCase);

      await service.restore('test-case-1', 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('削除されていないテストケースはConflictErrorを投げる', async () => {
      mockTestCaseRepo.findDeletedById.mockResolvedValue(null);
      mockPrisma.testCase.findUnique.mockResolvedValue(mockTestCase); // 削除されていない状態

      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(ConflictError);
      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(
        'Test case is not deleted'
      );
    });

    it('存在しないテストケースはNotFoundErrorを投げる', async () => {
      mockTestCaseRepo.findDeletedById.mockResolvedValue(null);
      mockPrisma.testCase.findUnique.mockResolvedValue(null);

      await expect(service.restore('invalid-case', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('30日を超過した削除済みテストケースはBadRequestErrorを投げる', async () => {
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 31); // 31日前
      const oldDeletedTestCase = {
        ...mockDeletedTestCase,
        deletedAt,
      };
      mockTestCaseRepo.findDeletedById.mockResolvedValue(oldDeletedTestCase);

      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(BadRequestError);
      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(
        '復元期限（30日）を過ぎています'
      );
    });

    it('30日以内の削除済みテストケースは復元できる', async () => {
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 29); // 29日前
      const recentlyDeletedTestCase = {
        ...mockDeletedTestCase,
        deletedAt,
      };
      mockTestCaseRepo.findDeletedById.mockResolvedValue(recentlyDeletedTestCase);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testCaseHistory.create.mockResolvedValue(mockHistory);
      mockTestCaseRepo.restore.mockResolvedValue(restoredTestCase);

      const result = await service.restore('test-case-1', 'user-1');

      expect(result.deletedAt).toBeNull();
    });

    it('削除済みテストスイートへの復元はBadRequestErrorを投げる', async () => {
      mockTestCaseRepo.findDeletedById.mockResolvedValue(mockDeletedTestCase);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockDeletedTestSuite);

      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(BadRequestError);
      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(
        '削除済みテストスイートへの復元はできません'
      );
    });

    it('存在しないテストスイートへの復元はBadRequestErrorを投げる', async () => {
      mockTestCaseRepo.findDeletedById.mockResolvedValue(mockDeletedTestCase);
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(BadRequestError);
      await expect(service.restore('test-case-1', 'user-1')).rejects.toThrow(
        'テストスイートが存在しません'
      );
    });

    it('スナップショットにdeletedAtが含まれる', async () => {
      // 30日以内の日付を使用
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 10);
      const deletedTestCaseWithDate = {
        ...mockDeletedTestCase,
        deletedAt,
      };
      mockTestCaseRepo.findDeletedById.mockResolvedValue(deletedTestCaseWithDate);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testCaseHistory.create.mockResolvedValue(mockHistory);
      mockTestCaseRepo.restore.mockResolvedValue(restoredTestCase);

      await service.restore('test-case-1', 'user-1');

      expect(mockPrisma.testCaseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            deletedAt: deletedAt.toISOString(),
          }),
        }),
      });
    });

    it('descriptionがnullのテストケースでも復元できる', async () => {
      const deletedWithNullDescription = {
        ...mockDeletedTestCase,
        description: null,
      };
      mockTestCaseRepo.findDeletedById.mockResolvedValue(deletedWithNullDescription);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockPrisma.testCaseHistory.create.mockResolvedValue(mockHistory);
      mockTestCaseRepo.restore.mockResolvedValue({ ...restoredTestCase, description: null });

      const result = await service.restore('test-case-1', 'user-1');

      expect(result.description).toBeNull();
    });
  });
});
