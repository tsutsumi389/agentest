import { prisma, type EntityStatus } from '@agentest/db';
import { NotFoundError } from '@agentest/shared';
import { UserRepository } from '../repositories/user.repository.js';

/** ダッシュボード統計のレスポンス型 */
export interface DashboardStats {
  projects: {
    total: number;
    testSuites: number;
  };
  executions: {
    passed: number;
    failed: number;
    total: number;
    weeklyCount: number;
    lastExecutedAt: Date | null;
  };
  recentExecutions: Array<{
    id: string;
    testSuiteId: string;
    testSuiteName: string;
    projectId: string;
    projectName: string;
    createdAt: Date;
    summary: {
      passed: number;
      failed: number;
      pending: number;
      total: number;
    };
    executedBy: {
      id: string;
      name: string;
      avatarUrl: string | null;
    } | null;
  }>;
}

/**
 * ユーザーサービス
 */
export class UserService {
  private userRepo = new UserRepository();

  /**
   * ユーザーをIDで検索
   */
  async findById(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    return user;
  }

  /**
   * ユーザーを更新
   */
  async update(userId: string, data: { name?: string; avatarUrl?: string | null }) {
    const user = await this.findById(userId);
    return this.userRepo.update(user.id, data);
  }

  /**
   * ユーザーを論理削除
   */
  async softDelete(userId: string) {
    await this.findById(userId);
    return this.userRepo.softDelete(userId);
  }

  /**
   * ユーザーの組織一覧を取得
   * @param userId ユーザーID
   * @param options オプション
   * @param options.includeDeleted 削除済み組織も含めるか（デフォルト: false）
   */
  async getOrganizations(userId: string, options: { includeDeleted?: boolean } = {}) {
    const { includeDeleted = false } = options;

    return prisma.organizationMember.findMany({
      where: {
        userId,
        organization: includeDeleted ? undefined : { deletedAt: null },
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarUrl: true,
            plan: true,
            createdAt: true,
            deletedAt: true,
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  /**
   * ユーザーのプロジェクト一覧を取得
   * @param userId ユーザーID
   * @param options 検索オプション
   * @param options.q 名前部分一致検索
   * @param options.organizationId 組織フィルタ（null指定で個人プロジェクトのみ）
   * @param options.includeDeleted 削除済みプロジェクトも含めるか（デフォルト: false）
   * @param options.limit 取得件数（デフォルト: 50）
   * @param options.offset 取得開始位置（デフォルト: 0）
   */
  async getProjects(
    userId: string,
    options: {
      q?: string;
      organizationId?: string | null;
      includeDeleted?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { q, organizationId, includeDeleted = false, limit = 50, offset = 0 } = options;

    // 削除条件
    const deletedCondition = includeDeleted ? {} : { deletedAt: null };

    // 名前検索条件
    const nameCondition = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};

    // 組織フィルタ条件
    // organizationId が undefined の場合: フィルタなし（全組織 + 個人）
    // organizationId が null の場合: 個人プロジェクトのみ
    // organizationId が文字列の場合: その組織のプロジェクトのみ
    const orgCondition =
      organizationId === undefined
        ? {}
        : organizationId === null
          ? { organizationId: null }
          : { organizationId };

    // 共通のwhere条件
    const baseWhere = {
      ...deletedCondition,
      ...nameCondition,
      ...orgCondition,
    };

    // 1クエリでメンバー、所属組織のプロジェクトを取得（OWNERもProjectMemberに含まれる）
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          // ユーザーが所属する組織のプロジェクト
          { organization: { members: { some: { userId } } } },
        ],
        ...baseWhere,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
        members: {
          where: { userId },
          select: { role: true },
        },
        _count: {
          select: { testSuites: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // ロールを付与して返却（OWNERもProjectMemberから取得）
    return projects.map((p) => {
      const { members, ...project } = p;
      const role = members[0]?.role ?? 'READ';
      return { ...project, role };
    });
  }

  /**
   * ユーザーのプロジェクト総数を取得
   * @param userId ユーザーID
   * @param options 検索オプション
   */
  async countProjects(
    userId: string,
    options: {
      q?: string;
      organizationId?: string | null;
      includeDeleted?: boolean;
    } = {}
  ) {
    const { q, organizationId, includeDeleted = false } = options;

    const deletedCondition = includeDeleted ? {} : { deletedAt: null };
    const nameCondition = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};
    const orgCondition =
      organizationId === undefined
        ? {}
        : organizationId === null
          ? { organizationId: null }
          : { organizationId };

    return prisma.project.count({
      where: {
        OR: [
          { members: { some: { userId } } },
          // ユーザーが所属する組織のプロジェクト
          { organization: { members: { some: { userId } } } },
        ],
        ...deletedCondition,
        ...nameCondition,
        ...orgCondition,
      },
    });
  }

  /**
   * テストスイート検索用のwhere条件を構築（共通ロジック）
   * @param userId ユーザーID
   * @param options 検索オプション
   */
  private buildTestSuiteWhereCondition(
    userId: string,
    options: {
      projectId?: string;
      q?: string;
      status?: EntityStatus;
    }
  ) {
    const { projectId, q, status } = options;

    // 名前検索条件
    const nameCondition = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};

    // ステータス条件
    const statusCondition = status ? { status } : {};

    // プロジェクトアクセス条件（共通）
    // projectId指定時も認可チェックを行う
    const accessCondition = {
      OR: [
        { members: { some: { userId } } },
        { organization: { members: { some: { userId } } } },
      ],
      deletedAt: null,
    };

    // プロジェクト条件
    const projectCondition = projectId
      ? {
          projectId,
          project: accessCondition,
        }
      : {
          project: accessCondition,
        };

    return {
      deletedAt: null,
      ...nameCondition,
      ...statusCondition,
      ...projectCondition,
    };
  }

  /**
   * ユーザーがアクセス可能なテストスイート一覧を取得
   * @param userId ユーザーID
   * @param options 検索オプション
   * @param options.projectId プロジェクトIDで絞り込み（省略時は全アクセス可能プロジェクト）
   * @param options.q テストスイート名で部分一致検索
   * @param options.status ステータスで絞り込み
   * @param options.limit 取得件数（デフォルト: 20）
   * @param options.offset 取得開始位置（デフォルト: 0）
   */
  async getTestSuites(
    userId: string,
    options: {
      projectId?: string;
      q?: string;
      status?: EntityStatus;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { limit = 20, offset = 0 } = options;
    const where = this.buildTestSuiteWhereCondition(userId, options);

    const testSuites = await prisma.testSuite.findMany({
      where,
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
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return testSuites;
  }

  /**
   * ユーザーがアクセス可能なテストスイートの総数を取得
   * @param userId ユーザーID
   * @param options 検索オプション
   */
  async countTestSuites(
    userId: string,
    options: {
      projectId?: string;
      q?: string;
      status?: EntityStatus;
    } = {}
  ) {
    const where = this.buildTestSuiteWhereCondition(userId, options);
    return prisma.testSuite.count({ where });
  }

  /**
   * ダッシュボード統計を取得
   * @param userId ユーザーID
   */
  async getDashboardStats(userId: string): Promise<DashboardStats> {
    // ユーザーがアクセス可能なプロジェクトの条件
    const projectAccessCondition = {
      OR: [
        { members: { some: { userId } } },
        { organization: { members: { some: { userId } } } },
      ],
      deletedAt: null,
    };

    // 今週の開始日（月曜日）を計算
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - daysToMonday);
    weekStart.setHours(0, 0, 0, 0);

    // 30日前を計算
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // 並列でデータを取得
    const [
      projectCount,
      testSuiteCount,
      executionStats,
      weeklyExecutions,
      lastExecution,
      recentExecutions,
    ] = await Promise.all([
      // プロジェクト数
      prisma.project.count({
        where: projectAccessCondition,
      }),
      // テストスイート数
      prisma.testSuite.count({
        where: {
          deletedAt: null,
          project: projectAccessCondition,
        },
      }),
      // 過去30日の期待結果統計
      prisma.executionExpectedResult.groupBy({
        by: ['status'],
        where: {
          execution: {
            testSuite: {
              project: projectAccessCondition,
            },
            createdAt: { gte: thirtyDaysAgo },
          },
        },
        _count: true,
      }),
      // 今週の実行回数
      prisma.execution.count({
        where: {
          testSuite: {
            project: projectAccessCondition,
          },
          createdAt: { gte: weekStart },
        },
      }),
      // 最終実行日時
      prisma.execution.findFirst({
        where: {
          testSuite: {
            project: projectAccessCondition,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      // 最近の実行（5件）
      prisma.execution.findMany({
        where: {
          testSuite: {
            project: projectAccessCondition,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          testSuite: {
            select: {
              id: true,
              name: true,
              projectId: true,
              project: {
                select: { id: true, name: true },
              },
            },
          },
          executedByUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
          expectedResults: {
            select: { status: true },
          },
        },
      }),
    ]);

    // 期待結果統計を集計
    let passed = 0;
    let failed = 0;
    let total = 0;
    for (const stat of executionStats) {
      const count = stat._count;
      total += count;
      if (stat.status === 'PASS') {
        passed = count;
      } else if (stat.status === 'FAIL') {
        failed = count;
      }
    }

    // 最近の実行を整形
    const formattedRecentExecutions = recentExecutions.map((exec) => {
      const summary = {
        passed: 0,
        failed: 0,
        pending: 0,
        total: exec.expectedResults.length,
      };
      for (const result of exec.expectedResults) {
        if (result.status === 'PASS') {
          summary.passed++;
        } else if (result.status === 'FAIL') {
          summary.failed++;
        } else if (result.status === 'PENDING') {
          summary.pending++;
        }
      }
      return {
        id: exec.id,
        testSuiteId: exec.testSuite.id,
        testSuiteName: exec.testSuite.name,
        projectId: exec.testSuite.project.id,
        projectName: exec.testSuite.project.name,
        createdAt: exec.createdAt,
        summary,
        executedBy: exec.executedByUser,
      };
    });

    return {
      projects: {
        total: projectCount,
        testSuites: testSuiteCount,
      },
      executions: {
        passed,
        failed,
        total,
        weeklyCount: weeklyExecutions,
        lastExecutedAt: lastExecution?.createdAt ?? null,
      },
      recentExecutions: formattedRecentExecutions,
    };
  }
}
