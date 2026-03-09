import { prisma } from '@agentest/db';
import { NotFoundError } from '@agentest/shared';
import type {
  ProjectDashboardStats,
  ProjectDashboardSummary,
  ResultDistribution,
  RecentActivityItem,
  DashboardFilterParams,
  ExecutionStatusSuites,
  FailingTestSuiteItem,
  SkippedTestSuiteItem,
  NeverExecutedTestSuiteItem,
  InProgressTestSuiteItem,
  PaginatedList,
} from '@agentest/shared';

// 統計対象の日数
const STATS_DAYS = 30;
// 最近の活動取得件数
const RECENT_ACTIVITIES_LIMIT = 10;
// テスト実行状況のデフォルト取得件数
const EXECUTION_STATUS_DEFAULT_LIMIT = 10;

/**
 * プロジェクトダッシュボードサービス
 */
export class ProjectDashboardService {
  /**
   * プロジェクトダッシュボード統計を取得
   */
  async getDashboard(projectId: string, filters?: DashboardFilterParams): Promise<ProjectDashboardStats> {
    // プロジェクトの存在確認
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // フィルター条件からテストスイートIDを取得
    const filteredTestSuiteIds = await this.getFilteredTestSuiteIds(projectId, filters);

    // 並行してデータを取得
    const [summary, resultDistribution, executionStatusSuites, recentActivities] =
      await Promise.all([
        this.getSummary(projectId, filteredTestSuiteIds),
        this.getResultDistribution(projectId, filteredTestSuiteIds, filters?.environmentId),
        this.getExecutionStatusSuites(projectId, filteredTestSuiteIds, filters?.environmentId),
        this.getRecentActivities(projectId, filteredTestSuiteIds, filters?.environmentId),
      ]);

    return {
      summary,
      resultDistribution,
      executionStatusSuites,
      recentActivities,
    };
  }

  /**
   * フィルター条件に基づいてテストスイートIDを取得
   *
   * フィルターの設計意図:
   * - ラベルフィルター: テストスイート自体をフィルタリング（TestSuiteLabelを通じて）
   *   → サマリー（テスト数）、実行状況、最近の活動すべてに適用
   * - 環境フィルター: 実行データのみをフィルタリング（ExecutionのenvironmentId）
   *   → 実行結果分布、実行状況、最近の活動に適用
   *   → サマリー（テスト数）には適用しない（テストの定義数は環境に依存しないため）
   */
  private async getFilteredTestSuiteIds(
    projectId: string,
    filters?: DashboardFilterParams
  ): Promise<string[] | undefined> {
    // ラベルフィルターがない場合はundefinedを返す（全テストスイートを対象）
    // 注: 環境フィルターはここでは処理せず、各メソッドで実行データに対して適用する
    if (!filters?.labelIds || filters.labelIds.length === 0) {
      return undefined;
    }

    // ラベルフィルターがある場合、該当するテストスイートを取得
    const testSuites = await prisma.testSuite.findMany({
      where: {
        projectId,
        deletedAt: null,
        testSuiteLabels: {
          some: {
            labelId: { in: filters.labelIds },
          },
        },
      },
      select: { id: true },
    });

    return testSuites.map((ts) => ts.id);
  }

  /**
   * サマリー統計を取得
   */
  private async getSummary(
    projectId: string,
    filteredTestSuiteIds?: string[]
  ): Promise<ProjectDashboardSummary> {
    // テストスイートのwhere条件を構築
    const testSuiteWhere = filteredTestSuiteIds
      ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
      : { projectId, deletedAt: null };

    // テストスイート総数
    const totalTestSuites = await prisma.testSuite.count({
      where: testSuiteWhere,
    });

    // テストケース総数
    const totalTestCases = await prisma.testCase.count({
      where: {
        testSuite: testSuiteWhere,
        deletedAt: null,
      },
    });

    // 期待結果総数
    const totalExpectedResults = await prisma.testCaseExpectedResult.count({
      where: {
        testCase: {
          testSuite: testSuiteWhere,
          deletedAt: null,
        },
      },
    });

    return {
      totalTestSuites,
      totalTestCases,
      totalExpectedResults,
    };
  }

  /**
   * 実行結果の分布を取得
   */
  private async getResultDistribution(
    projectId: string,
    filteredTestSuiteIds?: string[],
    environmentId?: string
  ): Promise<ResultDistribution> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - STATS_DAYS);

    // 実行のwhere条件を構築
    const executionWhere = {
      testSuite: filteredTestSuiteIds
        ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
        : { projectId, deletedAt: null },
      createdAt: { gte: thirtyDaysAgo },
      ...(environmentId && { environmentId }),
    };

    // 過去30日間の判定結果をカウント
    const results = await prisma.executionExpectedResult.groupBy({
      by: ['status'],
      where: {
        execution: executionWhere,
      },
      _count: { status: true },
    });

    const distribution: ResultDistribution = {
      pass: 0,
      fail: 0,
      skipped: 0,
      pending: 0,
    };

    for (const result of results) {
      switch (result.status) {
        case 'PASS':
          distribution.pass = result._count.status;
          break;
        case 'FAIL':
          distribution.fail = result._count.status;
          break;
        case 'SKIPPED':
          distribution.skipped = result._count.status;
          break;
        case 'PENDING':
          distribution.pending = result._count.status;
          break;
      }
    }

    return distribution;
  }

  /**
   * 最近の活動を取得
   */
  private async getRecentActivities(
    projectId: string,
    filteredTestSuiteIds?: string[],
    environmentId?: string
  ): Promise<RecentActivityItem[]> {
    const activities: RecentActivityItem[] = [];

    // テストスイートのwhere条件を構築
    const testSuiteWhere = filteredTestSuiteIds
      ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
      : { projectId, deletedAt: null };

    // 実行イベント
    const recentExecutions = await prisma.execution.findMany({
      where: {
        testSuite: testSuiteWhere,
        ...(environmentId && { environmentId }),
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      select: {
        id: true,
        createdAt: true,
        testSuite: {
          select: {
            id: true,
            name: true,
          },
        },
        executedByUser: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    for (const execution of recentExecutions) {
      activities.push({
        id: execution.id,
        type: 'execution',
        occurredAt: execution.createdAt,
        description: `「${execution.testSuite.name}」のテスト実行を開始`,
        testSuiteId: execution.testSuite.id,
        testSuiteName: execution.testSuite.name,
        actor: execution.executedByUser
          ? {
              id: execution.executedByUser.id,
              name: execution.executedByUser.name,
              avatarUrl: execution.executedByUser.avatarUrl,
            }
          : undefined,
      });
    }

    // テストケース更新イベント
    const recentTestCaseUpdates = await prisma.testCaseHistory.findMany({
      where: {
        testCase: {
          testSuite: testSuiteWhere,
        },
        changeType: 'UPDATE',
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      select: {
        id: true,
        createdAt: true,
        testCase: {
          select: {
            id: true,
            title: true,
            testSuite: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        changedBy: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    for (const history of recentTestCaseUpdates) {
      activities.push({
        id: history.id,
        type: 'testCaseUpdate',
        occurredAt: history.createdAt,
        description: `「${history.testCase.title}」を更新`,
        testSuiteId: history.testCase.testSuite.id,
        testSuiteName: history.testCase.testSuite.name,
        testCaseId: history.testCase.id,
        testCaseName: history.testCase.title,
        actor: history.changedBy
          ? {
              id: history.changedBy.id,
              name: history.changedBy.name,
              avatarUrl: history.changedBy.avatarUrl,
            }
          : undefined,
      });
    }

    // レビュー提出イベント
    const recentReviews = await prisma.review.findMany({
      where: {
        testSuite: testSuiteWhere,
        status: 'SUBMITTED',
      },
      orderBy: { submittedAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      select: {
        id: true,
        submittedAt: true,
        verdict: true,
        testSuite: {
          select: {
            id: true,
            name: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    for (const review of recentReviews) {
      const verdictText =
        review.verdict === 'APPROVED'
          ? '承認'
          : review.verdict === 'CHANGES_REQUESTED'
            ? '要修正'
            : 'コメント';
      activities.push({
        id: review.id,
        type: 'review',
        occurredAt: review.submittedAt ?? new Date(),
        description: `「${review.testSuite.name}」のレビューを${verdictText}`,
        testSuiteId: review.testSuite.id,
        testSuiteName: review.testSuite.name,
        actor: review.author
          ? {
              id: review.author.id,
              name: review.author.name,
              avatarUrl: review.author.avatarUrl,
            }
          : undefined,
      });
    }

    // 日時でソートして上位N件を返す
    return activities
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, RECENT_ACTIVITIES_LIMIT);
  }

  // ============================================================
  // テスト実行状況（テストスイート単位）
  // ============================================================

  /**
   * テスト実行状況（テストスイート単位）を取得
   */
  private async getExecutionStatusSuites(
    projectId: string,
    filteredTestSuiteIds?: string[],
    environmentId?: string,
    limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
  ): Promise<ExecutionStatusSuites> {
    const [failingSuites, skippedSuites, neverExecutedSuites, inProgressSuites] =
      await Promise.all([
        this.getFailingSuites(projectId, filteredTestSuiteIds, environmentId, limit),
        this.getSkippedSuites(projectId, filteredTestSuiteIds, environmentId, limit),
        this.getNeverExecutedSuites(projectId, filteredTestSuiteIds, limit),
        this.getInProgressSuites(projectId, filteredTestSuiteIds, environmentId, limit),
      ]);

    return {
      failingSuites,
      skippedSuites,
      neverExecutedSuites,
      inProgressSuites,
    };
  }

  /**
   * 失敗中テストスイートを取得
   * 最終実行の期待結果にFAILを含むテストスイート
   */
  private async getFailingSuites(
    projectId: string,
    filteredTestSuiteIds?: string[],
    environmentId?: string,
    limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
  ): Promise<PaginatedList<FailingTestSuiteItem>> {
    // テストスイートのwhere条件を構築
    const testSuiteWhere = filteredTestSuiteIds
      ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
      : { projectId, deletedAt: null };

    // 全テストスイートと最新実行を取得
    const testSuites = await prisma.testSuite.findMany({
      where: testSuiteWhere,
      select: {
        id: true,
        name: true,
        executions: {
          where: environmentId ? { environmentId } : {},
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            environment: {
              select: { id: true, name: true },
            },
            expectedResults: {
              select: { status: true },
            },
          },
        },
      },
    });

    // FAILを含むものをフィルタリング
    const failingItems: FailingTestSuiteItem[] = [];

    for (const suite of testSuites) {
      const lastExecution = suite.executions[0];
      if (!lastExecution) continue;

      const failCount = lastExecution.expectedResults.filter(
        (r) => r.status === 'FAIL'
      ).length;

      if (failCount > 0) {
        failingItems.push({
          testSuiteId: suite.id,
          testSuiteName: suite.name,
          lastExecutionId: lastExecution.id,
          lastExecutedAt: lastExecution.createdAt,
          environment: lastExecution.environment,
          failCount,
          totalExpectedResults: lastExecution.expectedResults.length,
        });
      }
    }

    // 失敗件数でソート
    failingItems.sort((a, b) => b.failCount - a.failCount);

    return {
      items: failingItems.slice(0, limit),
      total: failingItems.length,
    };
  }

  /**
   * スキップ中テストスイートを取得
   * 最終実行の期待結果にSKIPPEDを含むテストスイート
   */
  private async getSkippedSuites(
    projectId: string,
    filteredTestSuiteIds?: string[],
    environmentId?: string,
    limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
  ): Promise<PaginatedList<SkippedTestSuiteItem>> {
    // テストスイートのwhere条件を構築
    const testSuiteWhere = filteredTestSuiteIds
      ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
      : { projectId, deletedAt: null };

    // 全テストスイートと最新実行を取得
    const testSuites = await prisma.testSuite.findMany({
      where: testSuiteWhere,
      select: {
        id: true,
        name: true,
        executions: {
          where: environmentId ? { environmentId } : {},
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            environment: {
              select: { id: true, name: true },
            },
            expectedResults: {
              select: { status: true },
            },
          },
        },
      },
    });

    // SKIPPEDを含むものをフィルタリング
    const skippedItems: SkippedTestSuiteItem[] = [];

    for (const suite of testSuites) {
      const lastExecution = suite.executions[0];
      if (!lastExecution) continue;

      const skippedCount = lastExecution.expectedResults.filter(
        (r) => r.status === 'SKIPPED'
      ).length;

      if (skippedCount > 0) {
        skippedItems.push({
          testSuiteId: suite.id,
          testSuiteName: suite.name,
          lastExecutionId: lastExecution.id,
          lastExecutedAt: lastExecution.createdAt,
          environment: lastExecution.environment,
          skippedCount,
          totalExpectedResults: lastExecution.expectedResults.length,
        });
      }
    }

    // スキップ件数でソート
    skippedItems.sort((a, b) => b.skippedCount - a.skippedCount);

    return {
      items: skippedItems.slice(0, limit),
      total: skippedItems.length,
    };
  }

  /**
   * 未実行テストスイートを取得
   * 一度も実行されていないテストスイート
   */
  private async getNeverExecutedSuites(
    projectId: string,
    filteredTestSuiteIds?: string[],
    limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
  ): Promise<PaginatedList<NeverExecutedTestSuiteItem>> {
    // テストスイートのwhere条件を構築
    const testSuiteWhere = filteredTestSuiteIds
      ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
      : { projectId, deletedAt: null };

    // 全テストスイートと実行件数を取得
    const testSuites = await prisma.testSuite.findMany({
      where: testSuiteWhere,
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: {
          select: {
            executions: true,
            testCases: { where: { deletedAt: null } },
          },
        },
      },
    });

    // 実行0件のものをフィルタリング
    const neverExecutedItems: NeverExecutedTestSuiteItem[] = testSuites
      .filter((suite) => suite._count.executions === 0)
      .map((suite) => ({
        testSuiteId: suite.id,
        testSuiteName: suite.name,
        createdAt: suite.createdAt,
        testCaseCount: suite._count.testCases,
      }));

    // 作成日時でソート（古い順）
    neverExecutedItems.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    return {
      items: neverExecutedItems.slice(0, limit),
      total: neverExecutedItems.length,
    };
  }

  /**
   * 実行中テストスイートを取得
   * 最終実行の期待結果にPENDINGを含むテストスイート
   */
  private async getInProgressSuites(
    projectId: string,
    filteredTestSuiteIds?: string[],
    environmentId?: string,
    limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
  ): Promise<PaginatedList<InProgressTestSuiteItem>> {
    // テストスイートのwhere条件を構築
    const testSuiteWhere = filteredTestSuiteIds
      ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
      : { projectId, deletedAt: null };

    // 全テストスイートと最新実行を取得
    const testSuites = await prisma.testSuite.findMany({
      where: testSuiteWhere,
      select: {
        id: true,
        name: true,
        executions: {
          where: environmentId ? { environmentId } : {},
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            createdAt: true,
            environment: {
              select: { id: true, name: true },
            },
            expectedResults: {
              select: { status: true },
            },
          },
        },
      },
    });

    // PENDINGを含むものをフィルタリング
    const inProgressItems: InProgressTestSuiteItem[] = [];

    for (const suite of testSuites) {
      const lastExecution = suite.executions[0];
      if (!lastExecution) continue;

      const pendingCount = lastExecution.expectedResults.filter(
        (r) => r.status === 'PENDING'
      ).length;

      if (pendingCount > 0) {
        inProgressItems.push({
          testSuiteId: suite.id,
          testSuiteName: suite.name,
          lastExecutionId: lastExecution.id,
          lastExecutedAt: lastExecution.createdAt,
          environment: lastExecution.environment,
          pendingCount,
          totalExpectedResults: lastExecution.expectedResults.length,
        });
      }
    }

    // 未判定件数でソート
    inProgressItems.sort((a, b) => b.pendingCount - a.pendingCount);

    return {
      items: inProgressItems.slice(0, limit),
      total: inProgressItems.length,
    };
  }
}
