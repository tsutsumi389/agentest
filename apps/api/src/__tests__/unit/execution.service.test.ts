import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError } from '@agentest/shared';

// vi.mockはホイスティングされるため、ファクトリ内で直接定義する

// ExecutionRepository のモック
vi.mock('../../repositories/execution.repository.js', () => ({
  ExecutionRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    findByTestSuiteId: vi.fn(),
  })),
}));

// notificationServiceのモック
vi.mock('../../services/notification.service.js', () => ({
  notificationService: {
    send: vi.fn(),
  },
}));

// redis-publisherのモック
vi.mock('../../lib/redis-publisher.js', () => ({
  publishDashboardUpdated: vi.fn(),
}));

// execution-eventsのモック
vi.mock('../../lib/execution-events.js', () => ({
  publishExecutionPreconditionUpdated: vi.fn(),
  publishExecutionStepUpdated: vi.fn(),
  publishExecutionExpectedResultUpdated: vi.fn(),
  publishExecutionEvidenceAdded: vi.fn(),
}));

// prismaのモック
vi.mock('@agentest/db', () => ({
  prisma: {
    execution: {
      findUnique: vi.fn(),
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
      findMany: vi.fn(),
    },
    executionEvidence: {
      create: vi.fn(),
    },
    project: {
      findUnique: vi.fn(),
    },
  },
}));

// モック設定後にインポート
import { ExecutionService } from '../../services/execution.service.js';
import { prisma } from '@agentest/db';
import { notificationService } from '../../services/notification.service.js';
import { ExecutionRepository } from '../../repositories/execution.repository.js';

// テスト用の固定ID
const TEST_EXECUTION_ID = '11111111-1111-1111-1111-111111111111';
const TEST_SUITE_ID = '22222222-2222-2222-2222-222222222222';
const TEST_PROJECT_ID = '33333333-3333-3333-3333-333333333333';
const TEST_USER_ID = '44444444-4444-4444-4444-444444444444';
const TEST_PRECOND_RESULT_ID = '55555555-5555-5555-5555-555555555555';
const TEST_STEP_RESULT_ID = '66666666-6666-6666-6666-666666666666';
const TEST_EXPECTED_RESULT_ID = '77777777-7777-7777-7777-777777777777';

// 標準的な実行データを作成するヘルパー
function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: TEST_EXECUTION_ID,
    testSuiteId: TEST_SUITE_ID,
    createdAt: new Date(),
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

// モック参照を取得するヘルパー
const getMockedExecutionRepo = () => {
  const mockInstance = vi.mocked(ExecutionRepository).mock.results[0]?.value;
  return mockInstance;
};

describe('ExecutionService', () => {
  let service: ExecutionService;
  let mockExecutionRepo: ReturnType<typeof getMockedExecutionRepo>;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExecutionService();
    mockExecutionRepo = getMockedExecutionRepo();
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

  describe('updatePreconditionResult', () => {
    beforeEach(() => {
      mockExecutionRepo.findById.mockResolvedValue(createMockExecution());
    });

    it('実施者情報（ユーザーID）が記録される', async () => {
      const mockResult = { id: TEST_PRECOND_RESULT_ID, executionId: TEST_EXECUTION_ID };
      (prisma.executionPreconditionResult.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult
      );
      (prisma.executionPreconditionResult.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockResult,
        status: 'MET',
        checkedByUserId: TEST_USER_ID,
        checkedByAgentName: null,
      });

      await service.updatePreconditionResult(
        TEST_EXECUTION_ID,
        TEST_PRECOND_RESULT_ID,
        { status: 'MET' },
        { userId: TEST_USER_ID }
      );

      expect(prisma.executionPreconditionResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            checkedByUserId: TEST_USER_ID,
            checkedByAgentName: undefined,
          }),
        })
      );
    });

    it('実施者情報（エージェント名）が記録される', async () => {
      const mockResult = { id: TEST_PRECOND_RESULT_ID, executionId: TEST_EXECUTION_ID };
      (prisma.executionPreconditionResult.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult
      );
      (prisma.executionPreconditionResult.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockResult,
        status: 'MET',
        checkedByUserId: TEST_USER_ID,
        checkedByAgentName: 'Claude Code Opus4.5',
      });

      await service.updatePreconditionResult(
        TEST_EXECUTION_ID,
        TEST_PRECOND_RESULT_ID,
        { status: 'MET' },
        { userId: TEST_USER_ID, agentName: 'Claude Code Opus4.5' }
      );

      expect(prisma.executionPreconditionResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            checkedByUserId: TEST_USER_ID,
            checkedByAgentName: 'Claude Code Opus4.5',
          }),
        })
      );
    });
  });

  describe('updateStepResult', () => {
    beforeEach(() => {
      mockExecutionRepo.findById.mockResolvedValue(createMockExecution());
    });

    it('実施者情報（ユーザーID）が記録される', async () => {
      const mockResult = { id: TEST_STEP_RESULT_ID, executionId: TEST_EXECUTION_ID };
      (prisma.executionStepResult.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult
      );
      (prisma.executionStepResult.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockResult,
        status: 'DONE',
        executedByUserId: TEST_USER_ID,
        executedByAgentName: null,
      });

      await service.updateStepResult(
        TEST_EXECUTION_ID,
        TEST_STEP_RESULT_ID,
        { status: 'DONE' },
        { userId: TEST_USER_ID }
      );

      expect(prisma.executionStepResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            executedByUserId: TEST_USER_ID,
            executedByAgentName: undefined,
          }),
        })
      );
    });

    it('実施者情報（エージェント名）が記録される', async () => {
      const mockResult = { id: TEST_STEP_RESULT_ID, executionId: TEST_EXECUTION_ID };
      (prisma.executionStepResult.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult
      );
      (prisma.executionStepResult.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockResult,
        status: 'DONE',
        executedByUserId: TEST_USER_ID,
        executedByAgentName: 'Claude Code Opus4.5',
      });

      await service.updateStepResult(
        TEST_EXECUTION_ID,
        TEST_STEP_RESULT_ID,
        { status: 'DONE' },
        { userId: TEST_USER_ID, agentName: 'Claude Code Opus4.5' }
      );

      expect(prisma.executionStepResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            executedByUserId: TEST_USER_ID,
            executedByAgentName: 'Claude Code Opus4.5',
          }),
        })
      );
    });
  });

  describe('updateExpectedResult', () => {
    beforeEach(() => {
      // 実行データのモック（通知送信をスキップするため実行者なし）
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: null,
        })
      );
      (prisma.execution.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        executedByUserId: null,
      });
    });

    it('実施者情報（ユーザーID）が記録される', async () => {
      const mockResult = { id: TEST_EXPECTED_RESULT_ID, executionId: TEST_EXECUTION_ID };
      (prisma.executionExpectedResult.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult
      );
      (prisma.executionExpectedResult.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockResult,
        status: 'PASS',
        judgedByUserId: TEST_USER_ID,
        judgedByAgentName: null,
      });

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: TEST_USER_ID }
      );

      expect(prisma.executionExpectedResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            judgedByUserId: TEST_USER_ID,
            judgedByAgentName: undefined,
          }),
        })
      );
    });

    it('実施者情報（エージェント名）が記録される', async () => {
      const mockResult = { id: TEST_EXPECTED_RESULT_ID, executionId: TEST_EXECUTION_ID };
      (prisma.executionExpectedResult.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult
      );
      (prisma.executionExpectedResult.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockResult,
        status: 'PASS',
        judgedByUserId: TEST_USER_ID,
        judgedByAgentName: 'Claude Code Opus4.5',
      });

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: TEST_USER_ID, agentName: 'Claude Code Opus4.5' }
      );

      expect(prisma.executionExpectedResult.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            judgedByUserId: TEST_USER_ID,
            judgedByAgentName: 'Claude Code Opus4.5',
          }),
        })
      );
    });
  });

  describe('テスト完了通知', () => {
    const EXECUTOR_USER_ID = 'executor-user-id';
    const JUDGER_USER_ID = 'judger-user-id';
    const ORG_ID = 'org-id';

    beforeEach(() => {
      // 共通のモック設定
      const mockResult = { id: TEST_EXPECTED_RESULT_ID, executionId: TEST_EXECUTION_ID };
      (prisma.executionExpectedResult.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockResult
      );
      (prisma.executionExpectedResult.update as ReturnType<typeof vi.fn>).mockResolvedValue({
        ...mockResult,
        status: 'PASS',
        judgedByUserId: JUDGER_USER_ID,
        judgedByUser: { id: JUDGER_USER_ID, name: 'Judger', avatarUrl: null },
      });
      (prisma.project.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: TEST_PROJECT_ID,
        organizationId: ORG_ID,
      });
    });

    it('全てPASSで完了した場合、TEST_COMPLETED通知を送信する', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
        { status: 'PASS' },
        { status: 'PASS' },
      ]);

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: JUDGER_USER_ID }
      );

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: EXECUTOR_USER_ID,
          type: 'TEST_COMPLETED',
          title: 'テスト実行が完了しました',
          body: expect.stringContaining('成功: 3件'),
          data: expect.objectContaining({
            executionId: TEST_EXECUTION_ID,
            testSuiteId: TEST_SUITE_ID,
            passCount: 3,
            failCount: 0,
            skippedCount: 0,
            totalCount: 3,
          }),
        })
      );
    });

    it('FAILが1件以上ある場合、TEST_FAILED通知を送信する', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
        { status: 'FAIL' },
        { status: 'PASS' },
      ]);

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: JUDGER_USER_ID }
      );

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: EXECUTOR_USER_ID,
          type: 'TEST_FAILED',
          title: 'テスト実行が失敗しました',
          body: expect.stringContaining('失敗: 1件'),
          data: expect.objectContaining({
            executionId: TEST_EXECUTION_ID,
            testSuiteId: TEST_SUITE_ID,
            passCount: 2,
            failCount: 1,
            skippedCount: 0,
            totalCount: 3,
          }),
        })
      );
    });

    it('全てSKIPPEDで完了した場合、TEST_COMPLETED通知を送信する', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'SKIPPED' },
        { status: 'SKIPPED' },
      ]);

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'SKIPPED' },
        { userId: JUDGER_USER_ID }
      );

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: EXECUTOR_USER_ID,
          type: 'TEST_COMPLETED',
          title: 'テスト実行が完了しました',
          body: expect.stringContaining('スキップ: 2件'),
          data: expect.objectContaining({
            testSuiteId: TEST_SUITE_ID,
            passCount: 0,
            failCount: 0,
            skippedCount: 2,
            totalCount: 2,
          }),
        })
      );
    });

    it('PENDINGが残っている場合、通知を送信しない', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
        { status: 'PENDING' },
        { status: 'PASS' },
      ]);

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: JUDGER_USER_ID }
      );

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('判定者と実行者が同じ場合、通知を送信しない', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
        { status: 'PASS' },
      ]);

      // 判定者と実行者が同じ
      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: EXECUTOR_USER_ID }
      );

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('実行者がいない場合、通知を送信しない', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: null,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
      ]);

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: JUDGER_USER_ID }
      );

      expect(notificationService.send).not.toHaveBeenCalled();
    });

    it('PASS/FAIL/SKIPPEDが混在する場合、正しい内訳が通知される', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
        { status: 'PASS' },
        { status: 'FAIL' },
        { status: 'SKIPPED' },
      ]);

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: JUDGER_USER_ID }
      );

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_FAILED',
          body: expect.stringMatching(/成功: 2件.*失敗: 1件.*スキップ: 1件/),
          data: expect.objectContaining({
            testSuiteId: TEST_SUITE_ID,
            passCount: 2,
            failCount: 1,
            skippedCount: 1,
            totalCount: 4,
          }),
        })
      );
    });

    it('organizationIdが通知に含まれる', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
      ]);

      await service.updateExpectedResult(
        TEST_EXECUTION_ID,
        TEST_EXPECTED_RESULT_ID,
        { status: 'PASS' },
        { userId: JUDGER_USER_ID }
      );

      expect(notificationService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
        })
      );
    });

    it('通知送信に失敗しても期待結果の更新は成功する', async () => {
      mockExecutionRepo.findById.mockResolvedValue(
        createMockExecution({
          executedByUserId: EXECUTOR_USER_ID,
        })
      );
      (prisma.executionExpectedResult.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
        { status: 'PASS' },
      ]);
      // 通知送信を失敗させる
      (notificationService.send as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('通知送信エラー')
      );

      // エラーがスローされないことを確認
      await expect(
        service.updateExpectedResult(
          TEST_EXECUTION_ID,
          TEST_EXPECTED_RESULT_ID,
          { status: 'PASS' },
          { userId: JUDGER_USER_ID }
        )
      ).resolves.not.toThrow();

      // 期待結果の更新は呼ばれている
      expect(prisma.executionExpectedResult.update).toHaveBeenCalled();
    });
  });
});
