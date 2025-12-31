import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@agentest/shared';

// ExecutionRepository のモック
const mockExecutionRepo = {
  findById: vi.fn(),
  findByIdWithDetails: vi.fn(),
  findByTestSuiteId: vi.fn(),
};

vi.mock('../../repositories/execution.repository.js', () => ({
  ExecutionRepository: vi.fn().mockImplementation(() => mockExecutionRepo),
}));

// prismaのモック
vi.mock('@agentest/db', () => ({
  prisma: {
    execution: {
      update: vi.fn(),
    },
    executionPreconditionResult: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    executionStepResult: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    executionExpectedResult: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    executionEvidence: {
      create: vi.fn(),
    },
  },
}));

// モック設定後にインポート
import { ExecutionService } from '../../services/execution.service.js';

// テスト用の固定ID
const TEST_EXECUTION_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_PROJECT_ID = '33333333-3333-3333-3333-333333333333';

// 標準的な実行データを作成するヘルパー
function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_EXECUTION_ID,
    testSuiteId: TEST_SUITE_ID,
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    completedAt: null,
    testSuite: {
      id: TEST_SUITE_ID,
      name: 'Test Suite',
      projectId: TEST_PROJECT_ID,
    },
    environment: null,
    executedByUser: null,
    ...overrides,
  };
}

// 詳細付き実行データを作成するヘルパー
function createMockExecutionWithDetails(overrides: Record<string, unknown> = {}) {
  return {
    ...createMockExecution(),
    executionTestSuite: {
      id: 'exec-suite-1',
      executionId: TEST_EXECUTION_ID,
      originalTestSuiteId: TEST_SUITE_ID,
      name: 'Test Suite',
      description: null,
      preconditions: [],
      testCases: [
        {
          id: 'exec-tc-1',
          executionTestSuiteId: 'exec-suite-1',
          originalTestCaseId: 'tc-1',
          title: 'Test Case 1',
          description: null,
          priority: 'MEDIUM',
          orderKey: '00001',
          preconditions: [],
          steps: [
            {
              id: 'exec-step-1',
              executionTestCaseId: 'exec-tc-1',
              originalStepId: 'step-1',
              content: 'Step 1',
              orderKey: '00001',
            },
          ],
          expectedResults: [
            {
              id: 'exec-expected-1',
              executionTestCaseId: 'exec-tc-1',
              originalExpectedResultId: 'expected-1',
              content: 'Expected 1',
              orderKey: '00001',
            },
          ],
        },
      ],
    },
    preconditionResults: [
      {
        id: 'precond-result-1',
        executionId: TEST_EXECUTION_ID,
        executionTestCaseId: null,
        executionSuitePreconditionId: null,
        executionCasePreconditionId: null,
        status: 'UNCHECKED',
        checkedAt: null,
        note: null,
        suitePrecondition: null,
        casePrecondition: null,
        executionTestCase: null,
      },
    ],
    stepResults: [
      {
        id: 'step-result-1',
        executionId: TEST_EXECUTION_ID,
        executionTestCaseId: 'exec-tc-1',
        executionStepId: 'exec-step-1',
        status: 'PENDING',
        executedAt: null,
        note: null,
        executionStep: { id: 'exec-step-1', content: 'Step 1' },
        executionTestCase: { id: 'exec-tc-1', title: 'Test Case 1' },
      },
    ],
    expectedResults: [
      {
        id: 'expected-result-1',
        executionId: TEST_EXECUTION_ID,
        executionTestCaseId: 'exec-tc-1',
        executionExpectedResultId: 'exec-expected-1',
        status: 'PENDING',
        judgedAt: null,
        note: null,
        evidences: [],
        executionExpectedResult: { id: 'exec-expected-1', content: 'Expected 1' },
        executionTestCase: { id: 'exec-tc-1', title: 'Test Case 1' },
      },
    ],
    ...overrides,
  };
}

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExecutionService();
  });

  describe('findById', () => {
    it('実行をIDで取得できる', async () => {
      const mockExecution = createMockExecution();
      mockExecutionRepo.findById.mockResolvedValue(mockExecution);

      const result = await service.findById(TEST_EXECUTION_ID);

      expect(mockExecutionRepo.findById).toHaveBeenCalledWith(TEST_EXECUTION_ID);
      expect(result).toEqual(mockExecution);
    });

    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockExecutionRepo.findById.mockResolvedValue(null);

      await expect(service.findById(TEST_EXECUTION_ID)).rejects.toThrow(NotFoundError);
      await expect(service.findById(TEST_EXECUTION_ID)).rejects.toThrow('Execution');
    });

    it('軽量版なのでスナップショットや結果データは含まない', async () => {
      const mockExecution = createMockExecution();
      mockExecutionRepo.findById.mockResolvedValue(mockExecution);

      const result = await service.findById(TEST_EXECUTION_ID);

      // 軽量版なのでスナップショットや結果データは含まれない
      expect(result).not.toHaveProperty('snapshot');
      expect(result).not.toHaveProperty('preconditionResults');
      expect(result).not.toHaveProperty('stepResults');
      expect(result).not.toHaveProperty('expectedResults');
    });
  });

  describe('findByIdWithDetails', () => {
    it('実行を詳細付きで取得できる', async () => {
      const mockExecution = createMockExecutionWithDetails();
      mockExecutionRepo.findByIdWithDetails.mockResolvedValue(mockExecution);

      const result = await service.findByIdWithDetails(TEST_EXECUTION_ID);

      expect(mockExecutionRepo.findByIdWithDetails).toHaveBeenCalledWith(TEST_EXECUTION_ID);
      expect(result).toEqual(mockExecution);
    });

    it('実行が存在しない場合はNotFoundErrorを投げる', async () => {
      mockExecutionRepo.findByIdWithDetails.mockResolvedValue(null);

      await expect(service.findByIdWithDetails(TEST_EXECUTION_ID)).rejects.toThrow(NotFoundError);
      await expect(service.findByIdWithDetails(TEST_EXECUTION_ID)).rejects.toThrow('Execution');
    });

    it('正規化されたテストスイートを含む', async () => {
      const mockExecution = createMockExecutionWithDetails();
      mockExecutionRepo.findByIdWithDetails.mockResolvedValue(mockExecution);

      const result = await service.findByIdWithDetails(TEST_EXECUTION_ID);

      expect(result.executionTestSuite).toBeDefined();
      expect(result.executionTestSuite?.name).toBe('Test Suite');
    });

    it('前提条件結果を含む', async () => {
      const mockExecution = createMockExecutionWithDetails();
      mockExecutionRepo.findByIdWithDetails.mockResolvedValue(mockExecution);

      const result = await service.findByIdWithDetails(TEST_EXECUTION_ID);

      expect(result.preconditionResults).toBeDefined();
      expect(result.preconditionResults).toHaveLength(1);
      expect(result.preconditionResults[0].status).toBe('UNCHECKED');
    });

    it('ステップ結果を含む', async () => {
      const mockExecution = createMockExecutionWithDetails();
      mockExecutionRepo.findByIdWithDetails.mockResolvedValue(mockExecution);

      const result = await service.findByIdWithDetails(TEST_EXECUTION_ID);

      expect(result.stepResults).toBeDefined();
      expect(result.stepResults).toHaveLength(1);
      expect(result.stepResults[0].status).toBe('PENDING');
    });

    it('期待結果を含む（エビデンス含む）', async () => {
      const mockExecution = createMockExecutionWithDetails({
        expectedResults: [
          {
            id: 'expected-result-1',
            executionId: TEST_EXECUTION_ID,
            executionTestCaseId: 'exec-tc-1',
            executionExpectedResultId: 'exec-expected-1',
            status: 'PASS',
            judgedAt: new Date(),
            note: 'OK',
            evidences: [
              {
                id: 'evidence-1',
                expectedResultId: 'expected-result-1',
                fileName: 'screenshot.png',
                fileUrl: 'https://example.com/screenshot.png',
                fileType: 'image/png',
                fileSize: BigInt(1024),
                description: 'Screenshot',
                createdAt: new Date(),
              },
            ],
            executionExpectedResult: { id: 'exec-expected-1', content: 'Expected 1' },
            executionTestCase: { id: 'exec-tc-1', title: 'Test Case 1' },
          },
        ],
      });
      mockExecutionRepo.findByIdWithDetails.mockResolvedValue(mockExecution);

      const result = await service.findByIdWithDetails(TEST_EXECUTION_ID);

      expect(result.expectedResults).toBeDefined();
      expect(result.expectedResults).toHaveLength(1);
      expect(result.expectedResults[0].status).toBe('PASS');
      expect(result.expectedResults[0].evidences).toHaveLength(1);
      expect(result.expectedResults[0].evidences[0].fileName).toBe('screenshot.png');
    });
  });
});
