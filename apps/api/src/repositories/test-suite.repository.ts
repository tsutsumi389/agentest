import { prisma } from '@agentest/db';
import type { EntityStatus } from '@prisma/client';

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
}
