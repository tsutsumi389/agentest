import { describe, it, expect, vi, beforeEach } from 'vitest';

// ロガーのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// イベント発行のモック
const mockPublishTestCaseUpdated = vi.hoisted(() => vi.fn());

vi.mock('../../lib/events.js', () => ({
  publishTestCaseUpdated: mockPublishTestCaseUpdated,
}));

// ダッシュボード更新のモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishDashboardUpdated: vi.fn().mockResolvedValue(undefined),
}));

// TestCaseRepository のモック
const mockTestCaseRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  findDeletedById: vi.fn(),
  restore: vi.fn(),
  getHistoriesGrouped: vi.fn(),
  getHistories: vi.fn(),
  countHistories: vi.fn(),
}));

vi.mock('../../repositories/test-case.repository.js', () => ({
  TestCaseRepository: vi.fn().mockImplementation(() => mockTestCaseRepo),
}));

// Prisma のモック
const mockPrisma = vi.hoisted(() => ({
  testSuite: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  testCase: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  testCasePrecondition: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseStep: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseExpectedResult: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  testCaseHistory: {
    create: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  organizationMember: {
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

import { TestCaseService } from '../../services/test-case.service.js';

describe('TestCaseService - イベント発行', () => {
  let service: TestCaseService;

  const mockTestSuite = {
    id: 'test-suite-1',
    projectId: 'project-1',
    name: 'Test Suite',
    description: 'Test Description',
    status: 'DRAFT',
    deletedAt: null,
  };

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
    testSuite: mockTestSuite,
  };

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
    mockPrisma.user.findUnique.mockResolvedValue(mockUser);
  });

  // ============================================================
  // 前提条件（Precondition）関連
  // ============================================================
  describe('前提条件（Precondition）', () => {
    const mockPrecondition = {
      id: 'precondition-1',
      testCaseId: 'test-case-1',
      content: 'ユーザーがログインしている',
      orderKey: '00001',
    };

    describe('addPrecondition', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCasePrecondition.findFirst.mockResolvedValue(null);
        mockPrisma.testCasePrecondition.create.mockResolvedValue(mockPrecondition);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.addPrecondition('test-case-1', 'user-1', { content: 'ユーザーがログインしている' });

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'precondition:add', oldValue: null, newValue: 'precondition-1' }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.addPrecondition('test-case-1', 'user-1', { content: '新しい前提条件' });

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('updatePrecondition', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCasePrecondition.findFirst.mockResolvedValue(mockPrecondition);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCasePrecondition.update.mockResolvedValue({
          ...mockPrecondition,
          content: '更新された前提条件',
        });
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.updatePrecondition('test-case-1', 'precondition-1', 'user-1', { content: '更新された前提条件' });

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'precondition:update', oldValue: 'ユーザーがログインしている', newValue: '更新された前提条件' }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.updatePrecondition('test-case-1', 'precondition-1', 'user-1', { content: '更新された前提条件' });

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('deletePrecondition', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCasePrecondition.findFirst.mockResolvedValue(mockPrecondition);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCasePrecondition.delete.mockResolvedValue(mockPrecondition);
        mockPrisma.testCasePrecondition.findMany.mockResolvedValue([]);
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.deletePrecondition('test-case-1', 'precondition-1', 'user-1');

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'precondition:delete', oldValue: 'precondition-1', newValue: null }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        await expect(service.deletePrecondition('test-case-1', 'precondition-1', 'user-1')).resolves.toBeUndefined();

        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('reorderPreconditions', () => {
      const mockPreconditions = [
        { id: 'precondition-1', testCaseId: 'test-case-1', content: '条件1', orderKey: '00001' },
        { id: 'precondition-2', testCaseId: 'test-case-1', content: '条件2', orderKey: '00002' },
      ];

      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCasePrecondition.findMany
          .mockResolvedValueOnce(mockPreconditions)
          .mockResolvedValueOnce(mockPreconditions);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCasePrecondition.update.mockResolvedValue({});
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.reorderPreconditions('test-case-1', ['precondition-2', 'precondition-1'], 'user-1');

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'precondition:reorder', oldValue: ['precondition-1', 'precondition-2'], newValue: ['precondition-2', 'precondition-1'] }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.reorderPreconditions('test-case-1', ['precondition-2', 'precondition-1'], 'user-1');

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });
  });

  // ============================================================
  // ステップ（Step）関連
  // ============================================================
  describe('ステップ（Step）', () => {
    const mockStep = {
      id: 'step-1',
      testCaseId: 'test-case-1',
      content: 'ログインボタンをクリック',
      orderKey: '00001',
    };

    describe('addStep', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseStep.findFirst.mockResolvedValue(null);
        mockPrisma.testCaseStep.create.mockResolvedValue(mockStep);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.addStep('test-case-1', 'user-1', { content: 'ログインボタンをクリック' });

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'step:add', oldValue: null, newValue: 'step-1' }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.addStep('test-case-1', 'user-1', { content: '新しいステップ' });

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('updateStep', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseStep.findFirst.mockResolvedValue(mockStep);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCaseStep.update.mockResolvedValue({
          ...mockStep,
          content: '更新されたステップ',
        });
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.updateStep('test-case-1', 'step-1', 'user-1', { content: '更新されたステップ' });

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'step:update', oldValue: 'ログインボタンをクリック', newValue: '更新されたステップ' }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.updateStep('test-case-1', 'step-1', 'user-1', { content: '更新されたステップ' });

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('deleteStep', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseStep.findFirst.mockResolvedValue(mockStep);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCaseStep.delete.mockResolvedValue(mockStep);
        mockPrisma.testCaseStep.findMany.mockResolvedValue([]);
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.deleteStep('test-case-1', 'step-1', 'user-1');

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'step:delete', oldValue: 'step-1', newValue: null }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        await expect(service.deleteStep('test-case-1', 'step-1', 'user-1')).resolves.toBeUndefined();

        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('reorderSteps', () => {
      const mockSteps = [
        { id: 'step-1', testCaseId: 'test-case-1', content: 'ステップ1', orderKey: '00001' },
        { id: 'step-2', testCaseId: 'test-case-1', content: 'ステップ2', orderKey: '00002' },
      ];

      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseStep.findMany
          .mockResolvedValueOnce(mockSteps)
          .mockResolvedValueOnce(mockSteps);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCaseStep.update.mockResolvedValue({});
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.reorderSteps('test-case-1', ['step-2', 'step-1'], 'user-1');

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'step:reorder', oldValue: ['step-1', 'step-2'], newValue: ['step-2', 'step-1'] }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.reorderSteps('test-case-1', ['step-2', 'step-1'], 'user-1');

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });
  });

  // ============================================================
  // 期待結果（ExpectedResult）関連
  // ============================================================
  describe('期待結果（ExpectedResult）', () => {
    const mockExpectedResult = {
      id: 'expected-1',
      testCaseId: 'test-case-1',
      content: 'ログイン画面が表示される',
      orderKey: '00001',
    };

    describe('addExpectedResult', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue(null);
        mockPrisma.testCaseExpectedResult.create.mockResolvedValue(mockExpectedResult);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.addExpectedResult('test-case-1', 'user-1', { content: 'ログイン画面が表示される' });

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'expectedResult:add', oldValue: null, newValue: 'expected-1' }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.addExpectedResult('test-case-1', 'user-1', { content: '新しい期待結果' });

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('updateExpectedResult', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue(mockExpectedResult);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCaseExpectedResult.update.mockResolvedValue({
          ...mockExpectedResult,
          content: '更新された期待結果',
        });
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.updateExpectedResult('test-case-1', 'expected-1', 'user-1', { content: '更新された期待結果' });

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'expectedResult:update', oldValue: 'ログイン画面が表示される', newValue: '更新された期待結果' }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.updateExpectedResult('test-case-1', 'expected-1', 'user-1', { content: '更新された期待結果' });

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('deleteExpectedResult', () => {
      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseExpectedResult.findFirst.mockResolvedValue(mockExpectedResult);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCaseExpectedResult.delete.mockResolvedValue(mockExpectedResult);
        mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue([]);
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.deleteExpectedResult('test-case-1', 'expected-1', 'user-1');

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'expectedResult:delete', oldValue: 'expected-1', newValue: null }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        await expect(service.deleteExpectedResult('test-case-1', 'expected-1', 'user-1')).resolves.toBeUndefined();

        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });

    describe('reorderExpectedResults', () => {
      const mockExpectedResults = [
        { id: 'expected-1', testCaseId: 'test-case-1', content: '期待結果1', orderKey: '00001' },
        { id: 'expected-2', testCaseId: 'test-case-1', content: '期待結果2', orderKey: '00002' },
      ];

      beforeEach(() => {
        mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
        mockPrisma.testCaseExpectedResult.findMany
          .mockResolvedValueOnce(mockExpectedResults)
          .mockResolvedValueOnce(mockExpectedResults);
        mockPrisma.testCaseHistory.create.mockResolvedValue({});
        mockPrisma.testCaseExpectedResult.update.mockResolvedValue({});
      });

      it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
        await service.reorderExpectedResults('test-case-1', ['expected-2', 'expected-1'], 'user-1');

        expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
          'test-case-1',
          'test-suite-1',
          'project-1',
          [{ field: 'expectedResult:reorder', oldValue: ['expected-1', 'expected-2'], newValue: ['expected-2', 'expected-1'] }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        );
      });

      it('イベント発行エラー時もメイン処理は成功する', async () => {
        mockLogger.error.mockClear();
        mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

        const result = await service.reorderExpectedResults('test-case-1', ['expected-2', 'expected-1'], 'user-1');

        expect(result).toBeDefined();
        expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
      });
    });
  });

  // ============================================================
  // copy
  // ============================================================
  describe('copy', () => {
    const mockSourceTestCase = {
      id: 'source-case-1',
      testSuiteId: 'test-suite-1',
      title: 'Original Test Case',
      description: 'Original Description',
      priority: 'MEDIUM',
      status: 'ACTIVE',
      orderKey: '00001',
      deletedAt: null,
      testSuite: { id: 'test-suite-1', projectId: 'project-1' },
      preconditions: [],
      steps: [],
      expectedResults: [],
    };

    const mockTargetTestSuite = {
      id: 'test-suite-1',
      name: 'Test Suite',
      deletedAt: null,
      project: { id: 'project-1' },
    };

    const mockNewTestCase = {
      id: 'new-case-1',
      testSuiteId: 'test-suite-1',
      title: 'Original Test Case (コピー)',
      description: 'Original Description',
      priority: 'MEDIUM',
      status: 'DRAFT',
      orderKey: '00002',
    };

    beforeEach(() => {
      mockPrisma.testCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrisma.testSuite.findFirst.mockResolvedValue(mockTargetTestSuite);
      mockPrisma.testCase.create.mockResolvedValue(mockNewTestCase);
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue([]);
      mockPrisma.testCaseStep.findMany.mockResolvedValue([]);
      mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue([]);
      mockPrisma.testCaseHistory.create.mockResolvedValue({});
      mockPrisma.testCase.findUnique.mockResolvedValue({
        ...mockNewTestCase,
        testSuite: { id: 'test-suite-1', name: 'Test Suite', projectId: 'project-1' },
        createdByUser: mockUser,
        preconditions: [],
        steps: [],
        expectedResults: [],
      });
    });

    it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
      await service.copy('source-case-1', 'user-1', {});

      expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
        'new-case-1',
        'test-suite-1',
        'project-1',
        [{ field: 'copy', oldValue: 'source-case-1', newValue: 'new-case-1' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
    });

    it('イベント発行エラー時もメイン処理は成功する', async () => {
      mockLogger.error.mockClear();
      mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.copy('source-case-1', 'user-1', {});

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
    });
  });

  // ============================================================
  // updateWithChildren
  // ============================================================
  describe('updateWithChildren', () => {
    beforeEach(() => {
      mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
      mockPrisma.testCasePrecondition.findMany.mockResolvedValue([]);
      mockPrisma.testCaseStep.findMany.mockResolvedValue([]);
      mockPrisma.testCaseExpectedResult.findMany.mockResolvedValue([]);
      mockPrisma.testCase.update.mockResolvedValue(mockTestCase);
      mockPrisma.testCaseHistory.create.mockResolvedValue({});
      mockPrisma.testCase.findUnique.mockResolvedValue({
        ...mockTestCase,
        preconditions: [],
        steps: [],
        expectedResults: [],
      });
    });

    it('publishTestCaseUpdatedが正しい引数で呼ばれる', async () => {
      await service.updateWithChildren('test-case-1', 'user-1', {
        title: '更新されたタイトル',
      });

      expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
        'test-case-1',
        'test-suite-1',
        'project-1',
        [{ field: 'updateWithChildren', oldValue: null, newValue: expect.any(String) }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );
    });

    it('イベント発行エラー時もメイン処理は成功する', async () => {
      mockLogger.error.mockClear();
      mockPublishTestCaseUpdated.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.updateWithChildren('test-case-1', 'user-1', {
        title: '更新されたタイトル',
      });

      expect(result).toBeDefined();
      expect(mockLogger.error).toHaveBeenCalledWith({ err: expect.any(Error) }, 'イベント発行エラー');
    });
  });

  // ============================================================
  // ユーザー名取得のエッジケース
  // ============================================================
  describe('ユーザー名取得', () => {
    beforeEach(() => {
      mockTestCaseRepo.findById.mockResolvedValue(mockTestCase);
      mockPrisma.testCasePrecondition.findFirst.mockResolvedValue(null);
      mockPrisma.testCasePrecondition.create.mockResolvedValue({
        id: 'precondition-1',
        testCaseId: 'test-case-1',
        content: 'test',
        orderKey: '00001',
      });
      mockPrisma.testCaseHistory.create.mockResolvedValue({});
    });

    it('ユーザー名が取得できない場合はUnknownが使用される', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await service.addPrecondition('test-case-1', 'user-1', { content: 'test' });

      expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        { type: 'user', id: 'user-1', name: 'Unknown' }
      );
    });

    it('ユーザー名がnullの場合はUnknownが使用される', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, name: null });

      await service.addPrecondition('test-case-1', 'user-1', { content: 'test' });

      expect(mockPublishTestCaseUpdated).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Array),
        { type: 'user', id: 'user-1', name: 'Unknown' }
      );
    });
  });
});
