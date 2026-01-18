import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionRepository } from '../../repositories/execution.repository.js';

// Prisma のモック（vi.hoistedでホイスティング問題を回避）
const mockPrismaExecution = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    execution: mockPrismaExecution,
  },
}));

describe('ExecutionRepository', () => {
  let repository: ExecutionRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ExecutionRepository();
  });

  describe('findById', () => {
    it('IDで実行を取得できる（軽量版）', async () => {
      const mockExecution = {
        id: 'execution-1',
        testSuiteId: 'suite-1',
        createdAt: new Date(),
        testSuite: {
          id: 'suite-1',
          name: 'Test Suite',
          projectId: 'project-1',
        },
        environment: {
          id: 'env-1',
          name: 'Development',
          slug: 'dev',
        },
        executedByUser: {
          id: 'user-1',
          name: 'Test User',
          avatarUrl: null,
        },
      };
      mockPrismaExecution.findUnique.mockResolvedValue(mockExecution);

      const result = await repository.findById('execution-1');

      expect(mockPrismaExecution.findUnique).toHaveBeenCalledWith({
        where: { id: 'execution-1' },
        include: {
          testSuite: {
            select: { id: true, name: true, projectId: true },
          },
          environment: {
            select: { id: true, name: true, slug: true },
          },
          executedByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
      expect(result).toEqual(mockExecution);
    });

    it('testSuite, environment, executedByUserがincludeされる', async () => {
      const mockExecution = {
        id: 'execution-1',
        testSuite: {
          id: 'suite-1',
          name: 'Test Suite',
          projectId: 'project-1',
        },
        environment: {
          id: 'env-1',
          name: 'Production',
          slug: 'prod',
        },
        executedByUser: {
          id: 'user-1',
          name: 'User',
          avatarUrl: 'https://example.com/avatar.png',
        },
      };
      mockPrismaExecution.findUnique.mockResolvedValue(mockExecution);

      const result = await repository.findById('execution-1');

      expect(result?.testSuite).toBeDefined();
      expect(result?.environment).toBeDefined();
      expect(result?.executedByUser).toBeDefined();
    });

    it('存在しない場合はnullを返す', async () => {
      mockPrismaExecution.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdWithDetails', () => {
    it('IDで実行を詳細付きで取得できる', async () => {
      const mockExecution = {
        id: 'execution-1',
        testSuiteId: 'suite-1',
        createdAt: new Date(),
        testSuite: {
          id: 'suite-1',
          name: 'Test Suite',
          projectId: 'project-1',
        },
        environment: {
          id: 'env-1',
          name: 'Development',
          slug: 'dev',
        },
        executedByUser: {
          id: 'user-1',
          name: 'Test User',
          avatarUrl: null,
        },
        executionTestSuite: {
          id: 'exec-suite-1',
          preconditions: [],
          testCases: [],
        },
        preconditionResults: [
          { id: 'precond-result-1', status: 'PASSED' },
        ],
        stepResults: [
          { id: 'step-result-1', status: 'PASSED' },
        ],
        expectedResults: [
          {
            id: 'expected-result-1',
            status: 'PASSED',
            evidences: [
              { id: 'evidence-1', fileName: 'screenshot.png' },
            ],
          },
        ],
      };
      mockPrismaExecution.findUnique.mockResolvedValue(mockExecution);

      const result = await repository.findByIdWithDetails('execution-1');

      expect(mockPrismaExecution.findUnique).toHaveBeenCalledWith({
        where: { id: 'execution-1' },
        include: {
          testSuite: {
            select: { id: true, name: true, projectId: true },
          },
          environment: {
            select: { id: true, name: true, slug: true },
          },
          executedByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          executionTestSuite: {
            include: {
              preconditions: {
                orderBy: { orderKey: 'asc' },
              },
              testCases: {
                include: {
                  preconditions: {
                    orderBy: { orderKey: 'asc' },
                  },
                  steps: {
                    orderBy: { orderKey: 'asc' },
                  },
                  expectedResults: {
                    orderBy: { orderKey: 'asc' },
                  },
                },
                orderBy: { orderKey: 'asc' },
              },
            },
          },
          preconditionResults: {
            include: {
              suitePrecondition: true,
              casePrecondition: true,
              executionTestCase: true,
              checkedByUser: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
            orderBy: { id: 'asc' },
          },
          stepResults: {
            include: {
              executionStep: true,
              executionTestCase: true,
              executedByUser: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
            orderBy: { id: 'asc' },
          },
          expectedResults: {
            include: {
              executionExpectedResult: true,
              executionTestCase: true,
              evidences: true,
              judgedByUser: {
                select: { id: true, name: true, avatarUrl: true },
              },
            },
            orderBy: { id: 'asc' },
          },
        },
      });
      expect(result).toEqual(mockExecution);
    });

    it('executionTestSuite, preconditionResults, stepResults, expectedResultsがincludeされる', async () => {
      const mockExecution = {
        id: 'execution-1',
        executionTestSuite: { id: 'exec-suite-1', preconditions: [], testCases: [] },
        preconditionResults: [{ id: 'pr-1' }],
        stepResults: [{ id: 'sr-1' }],
        expectedResults: [{ id: 'er-1', evidences: [] }],
      };
      mockPrismaExecution.findUnique.mockResolvedValue(mockExecution);

      const result = await repository.findByIdWithDetails('execution-1');

      expect(result?.executionTestSuite).toBeDefined();
      expect(result?.preconditionResults).toBeDefined();
      expect(result?.stepResults).toBeDefined();
      expect(result?.expectedResults).toBeDefined();
    });

    it('expectedResultsにevidencesがincludeされる', async () => {
      const mockExecution = {
        id: 'execution-1',
        expectedResults: [
          {
            id: 'expected-result-1',
            evidences: [
              { id: 'evidence-1', fileName: 'file.png' },
              { id: 'evidence-2', fileName: 'file2.pdf' },
            ],
          },
        ],
      };
      mockPrismaExecution.findUnique.mockResolvedValue(mockExecution);

      const result = await repository.findByIdWithDetails('execution-1');

      expect(result?.expectedResults?.[0]?.evidences).toHaveLength(2);
    });

    it('存在しない場合はnullを返す', async () => {
      mockPrismaExecution.findUnique.mockResolvedValue(null);

      const result = await repository.findByIdWithDetails('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByTestSuiteId', () => {
    it('テストスイートの実行一覧を取得できる', async () => {
      const mockExecutions = [
        {
          id: 'execution-1',
          testSuiteId: 'suite-1',
          createdAt: new Date('2024-01-02'),
          executedByUser: {
            id: 'user-1',
            name: 'User 1',
            avatarUrl: null,
          },
          environment: {
            id: 'env-1',
            name: 'Development',
            slug: 'dev',
          },
        },
        {
          id: 'execution-2',
          testSuiteId: 'suite-1',
          createdAt: new Date('2024-01-01'),
          executedByUser: {
            id: 'user-2',
            name: 'User 2',
            avatarUrl: null,
          },
          environment: {
            id: 'env-2',
            name: 'Production',
            slug: 'prod',
          },
        },
      ];
      mockPrismaExecution.findMany.mockResolvedValue(mockExecutions);

      const result = await repository.findByTestSuiteId('suite-1', { limit: 10, offset: 0 });

      expect(mockPrismaExecution.findMany).toHaveBeenCalledWith({
        where: { testSuiteId: 'suite-1' },
        include: {
          executedByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          environment: {
            select: { id: true, name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual(mockExecutions);
    });

    it('limit/offsetでページネーションできる', async () => {
      mockPrismaExecution.findMany.mockResolvedValue([]);

      await repository.findByTestSuiteId('suite-1', { limit: 5, offset: 10 });

      expect(mockPrismaExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        })
      );
    });

    it('createdAtの降順でソートされる', async () => {
      mockPrismaExecution.findMany.mockResolvedValue([]);

      await repository.findByTestSuiteId('suite-1', { limit: 10, offset: 0 });

      expect(mockPrismaExecution.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('実行がない場合は空配列を返す', async () => {
      mockPrismaExecution.findMany.mockResolvedValue([]);

      const result = await repository.findByTestSuiteId('suite-no-executions', { limit: 10, offset: 0 });

      expect(result).toEqual([]);
    });
  });
});
