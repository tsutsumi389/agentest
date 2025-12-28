import { prisma, type EntityStatus } from '@agentest/db';

/**
 * テストスイートリポジトリ
 */
export class TestSuiteRepository {
  /**
   * IDでテストスイートを検索
   */
  async findById(id: string) {
    return prisma.testSuite.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { testCases: true, preconditions: true },
        },
      },
    });
  }

  /**
   * テストスイートを更新
   */
  async update(id: string, data: { name?: string; description?: string | null; status?: EntityStatus }) {
    return prisma.testSuite.update({
      where: { id },
      data,
    });
  }

  /**
   * テストスイートを論理削除
   */
  async softDelete(id: string) {
    return prisma.testSuite.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * 削除済みテストスイートをIDで検索
   */
  async findDeletedById(id: string) {
    return prisma.testSuite.findFirst({
      where: {
        id,
        deletedAt: { not: null },
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        _count: {
          select: { testCases: true, preconditions: true },
        },
      },
    });
  }

  /**
   * テストスイートを復元（deletedAtをnullに設定）
   */
  async restore(id: string) {
    return prisma.testSuite.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  /**
   * 履歴一覧を取得
   */
  async getHistories(id: string, options: { limit: number; offset: number }) {
    return prisma.testSuiteHistory.findMany({
      where: { testSuiteId: id },
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
    return prisma.testSuiteHistory.count({
      where: { testSuiteId: id },
    });
  }
}
