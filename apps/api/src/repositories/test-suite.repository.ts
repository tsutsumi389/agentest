import { prisma, type EntityStatus, type Prisma } from '@agentest/db';

/**
 * テストスイート検索オプション
 */
export interface TestSuiteSearchOptions {
  q?: string;
  status?: EntityStatus;
  createdBy?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
  sortBy: 'name' | 'createdAt' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
  includeDeleted: boolean;
}

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

  /**
   * サジェスト用テストスイート検索
   */
  async suggest(projectId: string, options: { q?: string; limit: number }) {
    const where: Prisma.TestSuiteWhereInput = {
      projectId,
      deletedAt: null,
    };

    if (options.q) {
      where.OR = [
        { name: { contains: options.q, mode: 'insensitive' } },
        { description: { contains: options.q, mode: 'insensitive' } },
      ];
    }

    return prisma.testSuite.findMany({
      where,
      select: { id: true, name: true, description: true, status: true },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      take: options.limit,
    });
  }

  /**
   * テストスイートを検索
   */
  async search(projectId: string, options: TestSuiteSearchOptions) {
    const { q, status, createdBy, from, to, limit, offset, sortBy, sortOrder, includeDeleted } = options;

    // 検索条件を構築
    const where: Prisma.TestSuiteWhereInput = {
      projectId,
      // 削除済みを含めるかどうか
      deletedAt: includeDeleted ? undefined : null,
    };

    // ステータスフィルタ
    if (status) {
      where.status = status;
    }

    // 作成者フィルタ
    if (createdBy) {
      where.createdByUserId = createdBy;
    }

    // 日付フィルタ
    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
      }
      if (to) {
        where.createdAt.lte = new Date(to);
      }
    }

    // キーワード検索（名前または前提条件内容）
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        {
          preconditions: {
            some: {
              content: { contains: q, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    // ソート条件
    const orderBy: Prisma.TestSuiteOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // 検索実行
    const [items, total] = await Promise.all([
      prisma.testSuite.findMany({
        where,
        include: {
          createdByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { testCases: true, preconditions: true },
          },
        },
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.testSuite.count({ where }),
    ]);

    return { items, total };
  }
}
