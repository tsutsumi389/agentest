import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestCaseService } from '../../services/test-case.service.js';
import { NotFoundError, BadRequestError } from '@agentest/shared';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaTestCase = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
}));

const mockPrismaTestSuite = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

const mockPrismaTestCasePrecondition = vi.hoisted(() => ({
  createMany: vi.fn(),
  findMany: vi.fn(),
}));

const mockPrismaTestCaseStep = vi.hoisted(() => ({
  createMany: vi.fn(),
  findMany: vi.fn(),
}));

const mockPrismaTestCaseExpectedResult = vi.hoisted(() => ({
  createMany: vi.fn(),
  findMany: vi.fn(),
}));

const mockPrismaTestCaseHistory = vi.hoisted(() => ({
  create: vi.fn(),
}));

const mockTransaction = vi.hoisted(() => vi.fn());

vi.mock('@agentest/db', () => ({
  prisma: {
    testCase: mockPrismaTestCase,
    testSuite: mockPrismaTestSuite,
    testCasePrecondition: mockPrismaTestCasePrecondition,
    testCaseStep: mockPrismaTestCaseStep,
    testCaseExpectedResult: mockPrismaTestCaseExpectedResult,
    testCaseHistory: mockPrismaTestCaseHistory,
    $transaction: mockTransaction,
  },
}));

describe('TestCaseService - copy', () => {
  let service: TestCaseService;
  const userId = 'user-1';
  const testCaseId = 'test-case-1';
  const testSuiteId = 'test-suite-1';
  const targetTestSuiteId = 'test-suite-2';
  const projectId = 'project-1';

  const mockSourceTestCase = {
    id: testCaseId,
    testSuiteId,
    title: 'テストケース1',
    description: 'テストケースの説明',
    priority: 'HIGH',
    status: 'ACTIVE',
    orderKey: '00001',
    deletedAt: null,
    testSuite: {
      id: testSuiteId,
      projectId,
    },
    preconditions: [
      { id: 'pre-1', content: '前提条件1', orderKey: '00001' },
      { id: 'pre-2', content: '前提条件2', orderKey: '00002' },
    ],
    steps: [
      { id: 'step-1', content: 'ステップ1', orderKey: '00001' },
      { id: 'step-2', content: 'ステップ2', orderKey: '00002' },
    ],
    expectedResults: [{ id: 'result-1', content: '期待結果1', orderKey: '00001' }],
  };

  const mockTargetTestSuite = {
    id: targetTestSuiteId,
    name: 'Target Test Suite',
    deletedAt: null,
    project: { id: projectId },
  };

  const mockSameTestSuite = {
    id: testSuiteId,
    name: 'Same Test Suite',
    deletedAt: null,
    project: { id: projectId },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TestCaseService();
  });

  // ============================================================
  // 正常系
  // ============================================================
  describe('正常系', () => {
    it('同一テストスイート内にコピーできる', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result).toBeDefined();
      expect(result?.title).toBe('テストケース1 (コピー)');
    });

    it('別のテストスイートにコピーできる', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockTargetTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId: targetTestSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00001',
      };

      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: targetTestSuiteId, name: 'Target Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, { targetTestSuiteId });

      expect(result).toBeDefined();
      expect(result?.testSuiteId).toBe(targetTestSuiteId);
    });

    it('前提条件がコピーされる', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let createManyData: any[] = [];
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [
                { id: 'new-pre-1', content: '前提条件1', orderKey: '00001' },
                { id: 'new-pre-2', content: '前提条件2', orderKey: '00002' },
              ],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn().mockImplementation(({ data }) => {
              createManyData = data;
            }),
            findMany: vi.fn().mockResolvedValue([
              { id: 'new-pre-1', content: '前提条件1', orderKey: '00001' },
              { id: 'new-pre-2', content: '前提条件2', orderKey: '00002' },
            ]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result?.preconditions).toHaveLength(2);
      expect(createManyData).toHaveLength(2);
      expect(createManyData[0].content).toBe('前提条件1');
      expect(createManyData[1].content).toBe('前提条件2');
    });

    it('ステップがコピーされる', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let createManyData: any[] = [];
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [
                { id: 'new-step-1', content: 'ステップ1', orderKey: '00001' },
                { id: 'new-step-2', content: 'ステップ2', orderKey: '00002' },
              ],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn().mockImplementation(({ data }) => {
              createManyData = data;
            }),
            findMany: vi.fn().mockResolvedValue([
              { id: 'new-step-1', content: 'ステップ1', orderKey: '00001' },
              { id: 'new-step-2', content: 'ステップ2', orderKey: '00002' },
            ]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result?.steps).toHaveLength(2);
      expect(createManyData).toHaveLength(2);
      expect(createManyData[0].content).toBe('ステップ1');
      expect(createManyData[1].content).toBe('ステップ2');
    });

    it('期待結果がコピーされる', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let createManyData: any[] = [];
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [{ id: 'new-result-1', content: '期待結果1', orderKey: '00001' }],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn().mockImplementation(({ data }) => {
              createManyData = data;
            }),
            findMany: vi
              .fn()
              .mockResolvedValue([{ id: 'new-result-1', content: '期待結果1', orderKey: '00001' }]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result?.expectedResults).toHaveLength(1);
      expect(createManyData).toHaveLength(1);
      expect(createManyData[0].content).toBe('期待結果1');
    });

    it('カスタムタイトルを指定できる', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const customTitle = 'カスタムタイトル';
      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: customTitle,
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let createdTitle = '';
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockImplementation(({ data }) => {
              createdTitle = data.title;
              return newTestCase;
            }),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      await service.copy(testCaseId, userId, { title: customTitle });

      expect(createdTitle).toBe(customTitle);
    });

    it('タイトル未指定時は「(コピー)」が付与される', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let createdTitle = '';
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockImplementation(({ data }) => {
              createdTitle = data.title;
              return newTestCase;
            }),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      await service.copy(testCaseId, userId, {});

      expect(createdTitle).toBe('テストケース1 (コピー)');
    });

    it('コピー後のステータスはDRAFTになる', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let createdStatus = '';
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockImplementation(({ data }) => {
              createdStatus = data.status;
              return newTestCase;
            }),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      // コピー元はACTIVEステータス
      expect(mockSourceTestCase.status).toBe('ACTIVE');

      await service.copy(testCaseId, userId, {});

      // コピー後はDRAFT
      expect(createdStatus).toBe('DRAFT');
    });

    it('orderKeyが正しく生成される', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00003',
      };

      let createdOrderKey = '';
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            // 既存のテストケースのorderKeyは00002
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00002' }),
            create: vi.fn().mockImplementation(({ data }) => {
              createdOrderKey = data.orderKey;
              return newTestCase;
            }),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      await service.copy(testCaseId, userId, {});

      expect(createdOrderKey).toBe('00003');
    });

    it('履歴が記録される', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let historyData: any = null;
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn().mockImplementation(({ data }) => {
              historyData = data;
            }),
          },
        };
        return callback(txMock);
      });

      await service.copy(testCaseId, userId, {});

      expect(historyData).toBeDefined();
      expect(historyData.testCaseId).toBe(newTestCaseId);
      expect(historyData.changedByUserId).toBe(userId);
      expect(historyData.changeType).toBe('CREATE');
      expect(historyData.snapshot.changeDetail.type).toBe('COPY');
      expect(historyData.snapshot.changeDetail.sourceTestCaseId).toBe(testCaseId);
      expect(historyData.snapshot.changeDetail.sourceTitle).toBe('テストケース1');
    });
  });

  // ============================================================
  // 異常系
  // ============================================================
  describe('異常系', () => {
    it('存在しないテストケースの場合NotFoundError', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(null);

      await expect(service.copy('non-existent-id', userId, {})).rejects.toThrow(NotFoundError);
    });

    it('削除済みテストケースの場合BadRequestError', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue({
        ...mockSourceTestCase,
        deletedAt: new Date(),
      });

      await expect(service.copy(testCaseId, userId, {})).rejects.toThrow(BadRequestError);
      await expect(service.copy(testCaseId, userId, {})).rejects.toThrow(
        '削除済みテストケースはコピーできません'
      );
    });

    it('存在しないコピー先テストスイートの場合NotFoundError', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue(null);

      await expect(
        service.copy(testCaseId, userId, { targetTestSuiteId: 'non-existent-suite' })
      ).rejects.toThrow(NotFoundError);
    });

    it('別プロジェクトへのコピーはBadRequestError', async () => {
      mockPrismaTestCase.findFirst.mockResolvedValue(mockSourceTestCase);
      mockPrismaTestSuite.findFirst.mockResolvedValue({
        ...mockTargetTestSuite,
        project: { id: 'different-project-id' },
      });

      await expect(service.copy(testCaseId, userId, { targetTestSuiteId })).rejects.toThrow(
        BadRequestError
      );
      await expect(service.copy(testCaseId, userId, { targetTestSuiteId })).rejects.toThrow(
        '異なるプロジェクトへのコピーはできません'
      );
    });
  });

  // ============================================================
  // エッジケース
  // ============================================================
  describe('エッジケース', () => {
    it('前提条件がないテストケースをコピーできる', async () => {
      const sourceWithoutPreconditions = {
        ...mockSourceTestCase,
        preconditions: [],
      };
      mockPrismaTestCase.findFirst.mockResolvedValue(sourceWithoutPreconditions);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let preconditionCreateManyCalled = false;
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn().mockImplementation(() => {
              preconditionCreateManyCalled = true;
            }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result).toBeDefined();
      expect(preconditionCreateManyCalled).toBe(false);
    });

    it('ステップがないテストケースをコピーできる', async () => {
      const sourceWithoutSteps = {
        ...mockSourceTestCase,
        steps: [],
      };
      mockPrismaTestCase.findFirst.mockResolvedValue(sourceWithoutSteps);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let stepCreateManyCalled = false;
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn().mockImplementation(() => {
              stepCreateManyCalled = true;
            }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result).toBeDefined();
      expect(stepCreateManyCalled).toBe(false);
    });

    it('期待結果がないテストケースをコピーできる', async () => {
      const sourceWithoutExpectedResults = {
        ...mockSourceTestCase,
        expectedResults: [],
      };
      mockPrismaTestCase.findFirst.mockResolvedValue(sourceWithoutExpectedResults);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      let expectedResultCreateManyCalled = false;
      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn().mockImplementation(() => {
              expectedResultCreateManyCalled = true;
            }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result).toBeDefined();
      expect(expectedResultCreateManyCalled).toBe(false);
    });

    it('子エンティティが全てないテストケースをコピーできる', async () => {
      const sourceWithoutChildren = {
        ...mockSourceTestCase,
        preconditions: [],
        steps: [],
        expectedResults: [],
      };
      mockPrismaTestCase.findFirst.mockResolvedValue(sourceWithoutChildren);
      mockPrismaTestSuite.findFirst.mockResolvedValue(mockSameTestSuite);

      const newTestCaseId = 'new-test-case-1';
      const newTestCase = {
        id: newTestCaseId,
        testSuiteId,
        title: 'テストケース1 (コピー)',
        description: 'テストケースの説明',
        priority: 'HIGH',
        status: 'DRAFT',
        orderKey: '00002',
      };

      mockTransaction.mockImplementation(async (callback: any) => {
        const txMock = {
          testCase: {
            findFirst: vi.fn().mockResolvedValue({ orderKey: '00001' }),
            create: vi.fn().mockResolvedValue(newTestCase),
            findUnique: vi.fn().mockResolvedValue({
              ...newTestCase,
              testSuite: { id: testSuiteId, name: 'Test Suite', projectId },
              createdByUser: { id: userId, name: 'User', avatarUrl: null },
              preconditions: [],
              steps: [],
              expectedResults: [],
            }),
          },
          testCasePrecondition: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseStep: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseExpectedResult: {
            createMany: vi.fn(),
            findMany: vi.fn().mockResolvedValue([]),
          },
          testCaseHistory: {
            create: vi.fn(),
          },
        };
        return callback(txMock);
      });

      const result = await service.copy(testCaseId, userId, {});

      expect(result).toBeDefined();
      expect(result?.preconditions).toHaveLength(0);
      expect(result?.steps).toHaveLength(0);
      expect(result?.expectedResults).toHaveLength(0);
    });
  });
});
