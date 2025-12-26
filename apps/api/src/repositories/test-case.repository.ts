import { prisma, type TestCasePriority, type EntityStatus } from '@agentest/db';

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
}
