import { describe, it, expect, vi, beforeEach } from 'vitest';

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// イベント発行のモック
const mockPublishTestSuiteUpdated = vi.hoisted(() => vi.fn());

vi.mock('../../lib/events.js', () => ({
  publishTestSuiteUpdated: mockPublishTestSuiteUpdated,
}));

// ダッシュボード更新のモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishDashboardUpdated: vi.fn().mockResolvedValue(undefined),
}));

// TestSuiteRepository のモック
const mockTestSuiteRepo = vi.hoisted(() => ({
  findById: vi.fn(),
}));

vi.mock('../../repositories/test-suite.repository.js', () => ({
  TestSuiteRepository: vi.fn().mockImplementation(() => mockTestSuiteRepo),
}));

// TestCaseRepository のモック
vi.mock('../../repositories/test-case.repository.js', () => ({
  TestCaseRepository: vi.fn().mockImplementation(() => ({
    search: vi.fn(),
    suggest: vi.fn(),
  })),
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
  testCase: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  testSuiteHistory: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn((operations) => {
    if (Array.isArray(operations)) {
      return Promise.all(operations);
    }
    return operations(mockPrisma);
  }),
}));

vi.mock('@agentest/db', () => ({
  prisma: mockPrisma,
}));

import { TestSuiteService } from '../../services/test-suite.service.js';

describe('TestSuiteService - イベント発行', () => {
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

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
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
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
  });

  // ============================================================
  // addPrecondition
  // ============================================================
  describe('addPrecondition', () => {
    beforeEach(() => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(null);
      mockPrisma.testSuitePrecondition.create.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
    });

    it('publishTestSuiteUpdatedが正しい引数で呼ばれる', async () => {
      await service.addPrecondition('test-suite-1', 'user-1', {
        content: 'ユーザーがログインしている',
      });

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        'test-suite-1',
        'project-1',
        [{ field: 'precondition:add', oldValue: null, newValue: 'precondition-1' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
    });

    it('changes配列が正しい（field: precondition:add）', async () => {
      await service.addPrecondition('test-suite-1', 'user-1', {
        content: '新しい前提条件',
      });

      const callArgs = mockPublishTestSuiteUpdated.mock.calls[0];
      const changes = callArgs[2];

      expect(changes).toHaveLength(1);
      expect(changes[0].field).toBe('precondition:add');
      expect(changes[0].oldValue).toBeNull();
      expect(changes[0].newValue).toBe('precondition-1');
    });

    it('イベント発行エラー時もメイン処理は成功する', async () => {
      mockPublishTestSuiteUpdated.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.addPrecondition('test-suite-1', 'user-1', {
        content: 'ユーザーがログインしている',
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('precondition-1');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'イベント発行エラー'
      );
    });

    it('ユーザー名が取得できない場合はUnknownが使用される', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.addPrecondition('test-suite-1', 'user-1', {
        content: '新しい前提条件',
      });

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        'test-suite-1',
        'project-1',
        expect.any(Array),
        { type: 'user', id: 'user-1', name: 'Unknown' }
      );
    });
  });

  // ============================================================
  // updatePrecondition
  // ============================================================
  describe('updatePrecondition', () => {
    beforeEach(() => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({
        ...mockPrecondition,
        content: '更新された前提条件',
      });
    });

    it('publishTestSuiteUpdatedが正しい引数で呼ばれる', async () => {
      await service.updatePrecondition('test-suite-1', 'precondition-1', 'user-1', {
        content: '更新された前提条件',
      });

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        'test-suite-1',
        'project-1',
        [{ field: 'precondition:update', oldValue: 'ユーザーがログインしている', newValue: '更新された前提条件' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
    });

    it('イベント発行エラー時もメイン処理は成功する', async () => {
      mockPublishTestSuiteUpdated.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.updatePrecondition('test-suite-1', 'precondition-1', 'user-1', {
        content: '更新された前提条件',
      });

      expect(result).toBeDefined();
      expect(result.content).toBe('更新された前提条件');
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'イベント発行エラー'
      );
    });
  });

  // ============================================================
  // deletePrecondition
  // ============================================================
  describe('deletePrecondition', () => {
    beforeEach(() => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findFirst.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.delete.mockResolvedValue(mockPrecondition);
      mockPrisma.testSuitePrecondition.findMany.mockResolvedValue([]);
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({});
    });

    it('publishTestSuiteUpdatedが正しい引数で呼ばれる', async () => {
      await service.deletePrecondition('test-suite-1', 'precondition-1', 'user-1');

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        'test-suite-1',
        'project-1',
        [{ field: 'precondition:delete', oldValue: 'precondition-1', newValue: null }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
    });

    it('イベント発行エラー時もメイン処理は成功する', async () => {
      mockPublishTestSuiteUpdated.mockRejectedValueOnce(new Error('Redis error'));

      // 例外が投げられないことを確認
      await expect(
        service.deletePrecondition('test-suite-1', 'precondition-1', 'user-1')
      ).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'イベント発行エラー'
      );
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

    beforeEach(() => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testSuitePrecondition.findMany
        .mockResolvedValueOnce(mockPreconditions)
        .mockResolvedValueOnce(mockPreconditions);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testSuitePrecondition.update.mockResolvedValue({});
    });

    it('publishTestSuiteUpdatedが正しい引数で呼ばれる', async () => {
      await service.reorderPreconditions(
        'test-suite-1',
        ['precondition-3', 'precondition-1', 'precondition-2'],
        'user-1'
      );

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        'test-suite-1',
        'project-1',
        [{
          field: 'precondition:reorder',
          oldValue: ['precondition-1', 'precondition-2', 'precondition-3'],
          newValue: ['precondition-3', 'precondition-1', 'precondition-2'],
        }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
    });

    it('イベント発行エラー時もメイン処理は成功する', async () => {
      mockPublishTestSuiteUpdated.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.reorderPreconditions(
        'test-suite-1',
        ['precondition-3', 'precondition-1', 'precondition-2'],
        'user-1'
      );

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'イベント発行エラー'
      );
    });
  });

  // ============================================================
  // reorderTestCases
  // ============================================================
  describe('reorderTestCases', () => {
    const mockTestCases = [
      { id: 'test-case-1', testSuiteId: 'test-suite-1', title: 'ケース1', orderKey: '00001', deletedAt: null },
      { id: 'test-case-2', testSuiteId: 'test-suite-1', title: 'ケース2', orderKey: '00002', deletedAt: null },
      { id: 'test-case-3', testSuiteId: 'test-suite-1', title: 'ケース3', orderKey: '00003', deletedAt: null },
    ];

    beforeEach(() => {
      mockTestSuiteRepo.findById.mockResolvedValue(mockTestSuite);
      mockPrisma.testCase.findMany
        .mockResolvedValueOnce(mockTestCases)
        .mockResolvedValueOnce(mockTestCases);
      mockPrisma.testSuiteHistory.create.mockResolvedValue({});
      mockPrisma.testCase.update.mockResolvedValue({});
    });

    it('publishTestSuiteUpdatedが正しい引数で呼ばれる', async () => {
      await service.reorderTestCases(
        'test-suite-1',
        ['test-case-3', 'test-case-1', 'test-case-2'],
        'user-1'
      );

      expect(mockPublishTestSuiteUpdated).toHaveBeenCalledWith(
        'test-suite-1',
        'project-1',
        [{
          field: 'testCases:reorder',
          oldValue: ['test-case-1', 'test-case-2', 'test-case-3'],
          newValue: ['test-case-3', 'test-case-1', 'test-case-2'],
        }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
    });

    it('イベント発行エラー時もメイン処理は成功する', async () => {
      mockPublishTestSuiteUpdated.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.reorderTestCases(
        'test-suite-1',
        ['test-case-3', 'test-case-1', 'test-case-2'],
        'user-1'
      );

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'イベント発行エラー'
      );
    });
  });
});
