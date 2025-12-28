import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ConflictError } from '@agentest/shared';

// TestSuiteRepository のモック
const mockTestSuiteRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findDeletedById: vi.fn(),
  getHistories: vi.fn(),
  countHistories: vi.fn(),
  restore: vi.fn(),
}));

vi.mock('../../repositories/test-suite.repository.js', () => ({
  TestSuiteRepository: vi.fn().mockImplementation(() => mockTestSuiteRepo),
}));

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  testSuite: {
    findUnique: vi.fn(),
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

describe('TestSuiteService - History & Restore', () => {
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

  const mockDeletedTestSuite = {
    ...mockTestSuite,
    deletedAt: new Date(),
  };

  const mockHistory = {
    id: 'history-1',
    testSuiteId: 'test-suite-1',
    changedByUserId: 'user-1',
    changedByAgentSessionId: null,
    changeType: 'UPDATE' as const,
    snapshot: { name: 'Test Suite' },
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
    service = new TestSuiteService();
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
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockTestSuiteRepo.getHistories.mockResolvedValue(mockHistories);
      mockTestSuiteRepo.countHistories.mockResolvedValue(2);

      const result = await service.getHistories('test-suite-1', { limit: 20, offset: 0 });

      expect(mockPrisma.testSuite.findUnique).toHaveBeenCalledWith({
        where: { id: 'test-suite-1' },
      });
      expect(mockTestSuiteRepo.getHistories).toHaveBeenCalledWith('test-suite-1', { limit: 20, offset: 0 });
      expect(mockTestSuiteRepo.countHistories).toHaveBeenCalledWith('test-suite-1');
      expect(result.histories).toEqual(mockHistories);
      expect(result.total).toBe(2);
    });

    it('limitとoffsetを指定して履歴を取得できる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockTestSuiteRepo.getHistories.mockResolvedValue([mockHistories[0]]);
      mockTestSuiteRepo.countHistories.mockResolvedValue(10);

      const result = await service.getHistories('test-suite-1', { limit: 1, offset: 5 });

      expect(mockTestSuiteRepo.getHistories).toHaveBeenCalledWith('test-suite-1', { limit: 1, offset: 5 });
      expect(result.histories).toHaveLength(1);
      expect(result.total).toBe(10);
    });

    it('削除済みテストスイートでも履歴を取得できる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockDeletedTestSuite);
      mockTestSuiteRepo.getHistories.mockResolvedValue(mockHistories);
      mockTestSuiteRepo.countHistories.mockResolvedValue(2);

      const result = await service.getHistories('test-suite-1', { limit: 20, offset: 0 });

      expect(result.histories).toEqual(mockHistories);
      expect(result.total).toBe(2);
    });

    it('履歴が0件の場合、空配列と0を返す', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockTestSuiteRepo.getHistories.mockResolvedValue([]);
      mockTestSuiteRepo.countHistories.mockResolvedValue(0);

      const result = await service.getHistories('test-suite-1', { limit: 20, offset: 0 });

      expect(result.histories).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('存在しないテストスイートはNotFoundErrorを投げる', async () => {
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      await expect(service.getHistories('invalid-suite', { limit: 20, offset: 0 })).rejects.toThrow(NotFoundError);
    });

    it('履歴にユーザー情報が含まれる', async () => {
      const historyWithUser = {
        ...mockHistory,
        changedBy: { id: 'user-1', name: 'Test User', avatarUrl: 'https://example.com/avatar.png' },
      };
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockTestSuiteRepo.getHistories.mockResolvedValue([historyWithUser]);
      mockTestSuiteRepo.countHistories.mockResolvedValue(1);

      const result = await service.getHistories('test-suite-1', { limit: 20, offset: 0 });

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
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite);
      mockTestSuiteRepo.getHistories.mockResolvedValue([historyWithAgent]);
      mockTestSuiteRepo.countHistories.mockResolvedValue(1);

      const result = await service.getHistories('test-suite-1', { limit: 20, offset: 0 });

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
    const restoredTestSuite = {
      ...mockTestSuite,
      deletedAt: null,
    };

    it('削除済みテストスイートを復元できる', async () => {
      mockTestSuiteRepo.findDeletedById.mockResolvedValue(mockDeletedTestSuite);
      mockPrisma.testSuiteHistory.create.mockResolvedValue(mockHistory);
      mockTestSuiteRepo.restore.mockResolvedValue(restoredTestSuite);

      const result = await service.restore('test-suite-1', 'user-1');

      expect(mockTestSuiteRepo.findDeletedById).toHaveBeenCalledWith('test-suite-1');
      expect(result.deletedAt).toBeNull();
    });

    it('復元時に履歴が作成される', async () => {
      mockTestSuiteRepo.findDeletedById.mockResolvedValue(mockDeletedTestSuite);
      mockPrisma.testSuiteHistory.create.mockResolvedValue(mockHistory);
      mockTestSuiteRepo.restore.mockResolvedValue(restoredTestSuite);

      await service.restore('test-suite-1', 'user-1');

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: {
          testSuiteId: 'test-suite-1',
          changedByUserId: 'user-1',
          changeType: 'RESTORE',
          snapshot: expect.objectContaining({
            id: mockDeletedTestSuite.id,
            projectId: mockDeletedTestSuite.projectId,
            name: mockDeletedTestSuite.name,
            description: mockDeletedTestSuite.description,
            status: mockDeletedTestSuite.status,
          }),
        },
      });
    });

    it('復元がトランザクション内で実行される', async () => {
      mockTestSuiteRepo.findDeletedById.mockResolvedValue(mockDeletedTestSuite);
      mockPrisma.testSuiteHistory.create.mockResolvedValue(mockHistory);
      mockTestSuiteRepo.restore.mockResolvedValue(restoredTestSuite);

      await service.restore('test-suite-1', 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('削除されていないテストスイートはConflictErrorを投げる', async () => {
      mockTestSuiteRepo.findDeletedById.mockResolvedValue(null);
      mockPrisma.testSuite.findUnique.mockResolvedValue(mockTestSuite); // 削除されていない状態

      await expect(service.restore('test-suite-1', 'user-1')).rejects.toThrow(ConflictError);
      await expect(service.restore('test-suite-1', 'user-1')).rejects.toThrow('Test suite is not deleted');
    });

    it('存在しないテストスイートはNotFoundErrorを投げる', async () => {
      mockTestSuiteRepo.findDeletedById.mockResolvedValue(null);
      mockPrisma.testSuite.findUnique.mockResolvedValue(null);

      await expect(service.restore('invalid-suite', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('スナップショットにdeletedAtが含まれる', async () => {
      const deletedAt = new Date('2025-01-15T10:00:00Z');
      const deletedTestSuiteWithDate = {
        ...mockDeletedTestSuite,
        deletedAt,
      };
      mockTestSuiteRepo.findDeletedById.mockResolvedValue(deletedTestSuiteWithDate);
      mockPrisma.testSuiteHistory.create.mockResolvedValue(mockHistory);
      mockTestSuiteRepo.restore.mockResolvedValue(restoredTestSuite);

      await service.restore('test-suite-1', 'user-1');

      expect(mockPrisma.testSuiteHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({
            deletedAt: deletedAt.toISOString(),
          }),
        }),
      });
    });

    it('descriptionがnullのテストスイートでも復元できる', async () => {
      const deletedWithNullDescription = {
        ...mockDeletedTestSuite,
        description: null,
      };
      mockTestSuiteRepo.findDeletedById.mockResolvedValue(deletedWithNullDescription);
      mockPrisma.testSuiteHistory.create.mockResolvedValue(mockHistory);
      mockTestSuiteRepo.restore.mockResolvedValue({ ...restoredTestSuite, description: null });

      const result = await service.restore('test-suite-1', 'user-1');

      expect(result.description).toBeNull();
    });
  });
});
