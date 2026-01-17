import { prisma } from '@agentest/db';
import { NotFoundError } from '@agentest/shared';
import type {
  ProjectDashboardStats,
  ProjectDashboardSummary,
  ResultDistribution,
  AttentionRequired,
  FailingTestItem,
  LongNotExecutedItem,
  FlakyTestItem,
  RecentActivityItem,
  SuiteCoverageItem,
} from '@agentest/shared';

// 統計対象の日数
const STATS_DAYS = 30;
// 長期未実行とみなす日数
const LONG_NOT_EXECUTED_DAYS = 30;
// 不安定テスト判定用の実行回数
const FLAKY_EXECUTION_COUNT = 10;
// 不安定テストの成功率下限・上限
const FLAKY_PASS_RATE_MIN = 50;
const FLAKY_PASS_RATE_MAX = 90;
// 最近の活動取得件数
const RECENT_ACTIVITIES_LIMIT = 10;
// 要注意テストの取得件数
const ATTENTION_LIMIT = 10;

/**
 * プロジェクトダッシュボードサービス
 */
export class ProjectDashboardService {
  /**
   * プロジェクトダッシュボード統計を取得
   */
  async getDashboard(projectId: string): Promise<ProjectDashboardStats> {
    // プロジェクトの存在確認
    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
    });

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // 並行してデータを取得
    const [summary, resultDistribution, attentionRequired, recentActivities, suiteCoverage] =
      await Promise.all([
        this.getSummary(projectId),
        this.getResultDistribution(projectId),
        this.getAttentionRequired(projectId),
        this.getRecentActivities(projectId),
        this.getSuiteCoverage(projectId),
      ]);

    return {
      summary,
      resultDistribution,
      attentionRequired,
      recentActivities,
      suiteCoverage,
    };
  }

  /**
   * サマリー統計を取得
   */
  private async getSummary(projectId: string): Promise<ProjectDashboardSummary> {
    // テストケース総数
    const totalTestCases = await prisma.testCase.count({
      where: {
        testSuite: {
          projectId,
          deletedAt: null,
        },
        deletedAt: null,
      },
    });

    // 実行中テスト数
    const inProgressExecutions = await prisma.execution.count({
      where: {
        testSuite: {
          projectId,
          deletedAt: null,
        },
        status: 'IN_PROGRESS',
      },
    });

    // 最終実行日時と成功率
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - STATS_DAYS);

    // 最新の実行を取得
    const lastExecution = await prisma.execution.findFirst({
      where: {
        testSuite: {
          projectId,
          deletedAt: null,
        },
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });

    // 過去30日間の成功率を計算
    const expectedResults = await prisma.executionExpectedResult.findMany({
      where: {
        execution: {
          testSuite: {
            projectId,
            deletedAt: null,
          },
          status: 'COMPLETED',
          completedAt: { gte: thirtyDaysAgo },
        },
      },
      select: { status: true },
    });

    let overallPassRate = 0;
    if (expectedResults.length > 0) {
      const passCount = expectedResults.filter((r) => r.status === 'PASS').length;
      overallPassRate = Math.round((passCount / expectedResults.length) * 100);
    }

    return {
      totalTestCases,
      lastExecutionAt: lastExecution?.completedAt ?? null,
      overallPassRate,
      inProgressExecutions,
    };
  }

  /**
   * 実行結果の分布を取得
   */
  private async getResultDistribution(projectId: string): Promise<ResultDistribution> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - STATS_DAYS);

    // 過去30日間の判定結果をカウント
    const results = await prisma.executionExpectedResult.groupBy({
      by: ['status'],
      where: {
        execution: {
          testSuite: {
            projectId,
            deletedAt: null,
          },
          status: 'COMPLETED',
          completedAt: { gte: thirtyDaysAgo },
        },
      },
      _count: { status: true },
    });

    const distribution: ResultDistribution = {
      pass: 0,
      fail: 0,
      skipped: 0,
      notExecutable: 0,
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
        case 'NOT_EXECUTABLE':
          distribution.notExecutable = result._count.status;
          break;
        case 'PENDING':
          distribution.pending = result._count.status;
          break;
      }
    }

    return distribution;
  }

  /**
   * 要注意テスト一覧を取得
   */
  private async getAttentionRequired(projectId: string): Promise<AttentionRequired> {
    const [failingTests, longNotExecuted, flakyTests] = await Promise.all([
      this.getFailingTests(projectId),
      this.getLongNotExecutedTests(projectId),
      this.getFlakyTests(projectId),
    ]);

    return {
      failingTests,
      longNotExecuted,
      flakyTests,
    };
  }

  /**
   * 失敗中テスト（最新の実行でFAIL）を取得
   */
  private async getFailingTests(projectId: string): Promise<FailingTestItem[]> {
    // 各テストケースの最新の実行結果がFAILのものを取得
    // SQLで直接取得する方がパフォーマンスが良いが、Prismaの制約上、複数ステップで処理
    const testCases = await prisma.testCase.findMany({
      where: {
        testSuite: {
          projectId,
          deletedAt: null,
        },
        deletedAt: null,
      },
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
    });

    const failingTests: FailingTestItem[] = [];

    for (const testCase of testCases) {
      // このテストケースの最新の実行結果を取得
      const latestExpectedResult = await prisma.executionExpectedResult.findFirst({
        where: {
          executionTestCase: {
            originalTestCaseId: testCase.id,
          },
          execution: {
            status: 'COMPLETED',
          },
        },
        orderBy: {
          execution: {
            completedAt: 'desc',
          },
        },
        select: {
          status: true,
          execution: {
            select: {
              completedAt: true,
            },
          },
        },
      });

      if (latestExpectedResult?.status === 'FAIL') {
        // 連続失敗回数を計算
        const recentResults = await prisma.executionExpectedResult.findMany({
          where: {
            executionTestCase: {
              originalTestCaseId: testCase.id,
            },
            execution: {
              status: 'COMPLETED',
            },
          },
          orderBy: {
            execution: {
              completedAt: 'desc',
            },
          },
          take: 10,
          select: { status: true },
        });

        let consecutiveFailures = 0;
        for (const result of recentResults) {
          if (result.status === 'FAIL') {
            consecutiveFailures++;
          } else {
            break;
          }
        }

        failingTests.push({
          testCaseId: testCase.id,
          title: testCase.title,
          testSuiteId: testCase.testSuite.id,
          testSuiteName: testCase.testSuite.name,
          lastExecutedAt: latestExpectedResult.execution.completedAt!,
          consecutiveFailures,
        });
      }

      if (failingTests.length >= ATTENTION_LIMIT) break;
    }

    // 連続失敗回数でソート
    return failingTests.sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
  }

  /**
   * 長期未実行テスト（30日以上未実行）を取得
   */
  private async getLongNotExecutedTests(projectId: string): Promise<LongNotExecutedItem[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - LONG_NOT_EXECUTED_DAYS);
    const now = new Date();

    const testCases = await prisma.testCase.findMany({
      where: {
        testSuite: {
          projectId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        testSuite: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const longNotExecuted: LongNotExecutedItem[] = [];

    for (const testCase of testCases) {
      // このテストケースの最新の実行を取得
      const latestExecution = await prisma.executionExpectedResult.findFirst({
        where: {
          executionTestCase: {
            originalTestCaseId: testCase.id,
          },
          execution: {
            status: 'COMPLETED',
          },
        },
        orderBy: {
          execution: {
            completedAt: 'desc',
          },
        },
        select: {
          execution: {
            select: {
              completedAt: true,
            },
          },
        },
      });

      const lastExecutedAt = latestExecution?.execution.completedAt ?? null;
      const isLongNotExecuted =
        lastExecutedAt === null || lastExecutedAt < thirtyDaysAgo;

      if (isLongNotExecuted) {
        let daysSinceLastExecution: number | null = null;
        if (lastExecutedAt) {
          daysSinceLastExecution = Math.floor(
            (now.getTime() - lastExecutedAt.getTime()) / (1000 * 60 * 60 * 24)
          );
        }

        longNotExecuted.push({
          testCaseId: testCase.id,
          title: testCase.title,
          testSuiteId: testCase.testSuite.id,
          testSuiteName: testCase.testSuite.name,
          lastExecutedAt,
          daysSinceLastExecution,
        });
      }

      if (longNotExecuted.length >= ATTENTION_LIMIT) break;
    }

    // 未実行日数でソート（nullは先頭、その後未実行日数降順）
    return longNotExecuted.sort((a, b) => {
      if (a.daysSinceLastExecution === null && b.daysSinceLastExecution === null) return 0;
      if (a.daysSinceLastExecution === null) return -1;
      if (b.daysSinceLastExecution === null) return 1;
      return b.daysSinceLastExecution - a.daysSinceLastExecution;
    });
  }

  /**
   * 不安定なテスト（過去10回の成功率50-90%）を取得
   */
  private async getFlakyTests(projectId: string): Promise<FlakyTestItem[]> {
    const testCases = await prisma.testCase.findMany({
      where: {
        testSuite: {
          projectId,
          deletedAt: null,
        },
        deletedAt: null,
      },
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
    });

    const flakyTests: FlakyTestItem[] = [];

    for (const testCase of testCases) {
      // 過去10回の実行結果を取得
      const recentResults = await prisma.executionExpectedResult.findMany({
        where: {
          executionTestCase: {
            originalTestCaseId: testCase.id,
          },
          execution: {
            status: 'COMPLETED',
          },
        },
        orderBy: {
          execution: {
            completedAt: 'desc',
          },
        },
        take: FLAKY_EXECUTION_COUNT,
        select: { status: true },
      });

      if (recentResults.length >= 3) {
        // 最低3回の実行が必要
        const passCount = recentResults.filter((r) => r.status === 'PASS').length;
        const passRate = Math.round((passCount / recentResults.length) * 100);

        if (passRate >= FLAKY_PASS_RATE_MIN && passRate <= FLAKY_PASS_RATE_MAX) {
          flakyTests.push({
            testCaseId: testCase.id,
            title: testCase.title,
            testSuiteId: testCase.testSuite.id,
            testSuiteName: testCase.testSuite.name,
            passRate,
            totalExecutions: recentResults.length,
          });
        }
      }

      if (flakyTests.length >= ATTENTION_LIMIT) break;
    }

    // 成功率でソート（より不安定なものを先に）
    return flakyTests.sort((a, b) => {
      // 50%に近いほど不安定
      const aDiff = Math.abs(a.passRate - 50);
      const bDiff = Math.abs(b.passRate - 50);
      return aDiff - bDiff;
    });
  }

  /**
   * 最近の活動を取得
   */
  private async getRecentActivities(projectId: string): Promise<RecentActivityItem[]> {
    const activities: RecentActivityItem[] = [];

    // 実行完了イベント
    const recentExecutions = await prisma.execution.findMany({
      where: {
        testSuite: {
          projectId,
          deletedAt: null,
        },
        status: 'COMPLETED',
      },
      orderBy: { completedAt: 'desc' },
      take: RECENT_ACTIVITIES_LIMIT,
      select: {
        id: true,
        completedAt: true,
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
        occurredAt: execution.completedAt!,
        description: `「${execution.testSuite.name}」のテスト実行が完了`,
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
          testSuite: {
            projectId,
            deletedAt: null,
          },
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
        testSuite: {
          projectId,
          deletedAt: null,
        },
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
        occurredAt: review.submittedAt!,
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

  /**
   * テストスイート別カバレッジを取得
   */
  private async getSuiteCoverage(projectId: string): Promise<SuiteCoverageItem[]> {
    const testSuites = await prisma.testSuite.findMany({
      where: {
        projectId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            testCases: {
              where: { deletedAt: null },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const coverage: SuiteCoverageItem[] = [];

    for (const suite of testSuites) {
      // 最新の実行を取得
      const latestExecution = await prisma.execution.findFirst({
        where: {
          testSuiteId: suite.id,
          status: 'COMPLETED',
        },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          completedAt: true,
        },
      });

      let executedCount = 0;
      let passRate = 0;

      if (latestExecution) {
        // 最新実行での判定結果を取得
        const results = await prisma.executionExpectedResult.findMany({
          where: {
            executionId: latestExecution.id,
          },
          select: { status: true },
        });

        // 実行されたテストケース数をカウント（PENDINGでないもの）
        const executedResults = results.filter((r) => r.status !== 'PENDING');
        executedCount = executedResults.length;

        if (executedResults.length > 0) {
          const passCount = executedResults.filter((r) => r.status === 'PASS').length;
          passRate = Math.round((passCount / executedResults.length) * 100);
        }
      }

      coverage.push({
        testSuiteId: suite.id,
        name: suite.name,
        testCaseCount: suite._count.testCases,
        executedCount,
        passRate,
        lastExecutedAt: latestExecution?.completedAt ?? null,
      });
    }

    return coverage;
  }
}
