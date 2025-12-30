import { prisma } from '@agentest/db';

/**
 * 実行リポジトリ
 */
export class ExecutionRepository {
  /**
   * IDで実行を検索
   */
  async findById(id: string) {
    return prisma.execution.findUnique({
      where: { id },
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
        snapshot: true,
        preconditionResults: {
          orderBy: { id: 'asc' },
        },
        stepResults: {
          orderBy: { id: 'asc' },
        },
        expectedResults: {
          include: {
            evidences: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });
  }

  /**
   * IDで実行を詳細付きで検索（スナップショット、全結果データ含む）
   */
  async findByIdWithDetails(id: string) {
    return prisma.execution.findUnique({
      where: { id },
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
        snapshot: true,
        preconditionResults: {
          orderBy: { id: 'asc' },
        },
        stepResults: {
          orderBy: { id: 'asc' },
        },
        expectedResults: {
          include: {
            evidences: true,
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
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });
  }
}
