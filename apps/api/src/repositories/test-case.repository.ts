import { prisma, type TestCasePriority, type EntityStatus, type Prisma } from '@agentest/db';

/**
 * テストケース検索オプション
 */
export interface TestCaseSearchOptions {
  q?: string;
  status?: EntityStatus[];
  priority?: TestCasePriority[];
  limit: number;
  offset: number;
  sortBy: 'title' | 'createdAt' | 'updatedAt' | 'priority' | 'orderKey';
  sortOrder: 'asc' | 'desc';
  includeDeleted: boolean;
}

/**
 * テストケースリポジトリ
 */
export class TestCaseRepository {
  /**
   * IDでテストケースを検索
   */
  async findById(id: string) {
    return prisma.testCase.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        testSuite: {
          select: { id: true, name: true, projectId: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
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
    });
  }

  /**
   * テストケースを更新
   */
  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      priority?: TestCasePriority;
      status?: EntityStatus;
    }
  ) {
    return prisma.testCase.update({
      where: { id },
      data,
    });
  }

  /**
   * テストケースを論理削除
   */
  async softDelete(id: string) {
    return prisma.testCase.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * サジェスト用テストケース検索
   */
  async suggest(testSuiteId: string, options: { q?: string; limit: number }) {
    const where: Prisma.TestCaseWhereInput = {
      testSuiteId,
      deletedAt: null,
    };

    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: 'insensitive' } },
        { description: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    return prisma.testCase.findMany({
      where,
      select: { id: true, title: true, description: true, priority: true, status: true },
      orderBy: [{ status: 'asc' }, { orderKey: 'asc' }],
      take: options.limit,
    });
  }

  /**
   * テストケースを検索
   */
  async search(testSuiteId: string, options: TestCaseSearchOptions) {
    const where: Prisma.TestCaseWhereInput = {
      testSuiteId,
      deletedAt: options.includeDeleted ? undefined : null,
    };

    // 複数選択フィルタ
    if (options.status?.length) {
      where.status = { in: options.status };
    }
    if (options.priority?.length) {
      where.priority = { in: options.priority };
    }

    // キーワード検索（タイトル、手順、期待結果）
    if (options.q) {
      where.OR = [
        { title: { contains: options.q, mode: 'insensitive' } },
        { steps: { some: { content: { contains: options.q, mode: 'insensitive' } } } },
        { expectedResults: { some: { content: { contains: options.q, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.testCase.findMany({
        where,
        include: {
          createdByUser: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { preconditions: true, steps: true, expectedResults: true } },
        },
        orderBy: { [options.sortBy]: options.sortOrder },
        take: options.limit,
        skip: options.offset,
      }),
      prisma.testCase.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * 削除済みテストケースをIDで検索
   */
  async findDeletedById(id: string) {
    return prisma.testCase.findFirst({
      where: {
        id,
        deletedAt: { not: null },
      },
      include: {
        testSuite: {
          select: { id: true, name: true, projectId: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
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
    });
  }

  /**
   * テストケースを復元（deletedAtをnullに設定）
   */
  async restore(id: string) {
    return prisma.testCase.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * 履歴一覧を取得
   */
  async getHistories(id: string, options: { limit: number; offset: number }) {
    return prisma.testCaseHistory.findMany({
      where: { testCaseId: id },
      include: {
        changedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        agentSession: {
          select: { id: true, clientName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit,
      skip: options.offset,
    });
  }

  /**
   * 履歴件数を取得
   */
  async countHistories(id: string) {
    return prisma.testCaseHistory.count({
      where: { testCaseId: id },
    });
  }
}
