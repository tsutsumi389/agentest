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
}
