import { prisma } from '@agentest/db';

/**
 * 実行リポジトリ
 */
export class ExecutionRepository {
  /**
   * IDで実行を検索（軽量版：基本情報のみ）
   */
  async findById(id: string) {
    return prisma.execution.findUnique({
      where: { id },
      include: {
        testSuite: {
          select: { id: true, name: true, projectId: true },
        },
        environment: {
          select: { id: true, name: true },
        },
        executedByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * IDで実行を詳細付きで検索（正規化テーブル、全結果データ含む）
   */
  async findByIdWithDetails(id: string) {
    return prisma.execution.findUnique({
      where: { id },
      include: {
        testSuite: {
          select: { id: true, name: true, projectId: true },
        },
        environment: {
          select: { id: true, name: true },
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
  }

  /**
   * テストスイートの実行一覧を取得
   */
  async findByTestSuiteId(testSuiteId: string, options: { limit: number; offset: number }) {
    return prisma.execution.findMany({
      where: { testSuiteId },
      include: {
        executedByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        environment: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });
  }
}
