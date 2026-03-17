import { prisma } from '@agentest/db';
import type { RecentActivityItem } from '@agentest/shared';

// 最近の活動取得件数
const RECENT_ACTIVITIES_LIMIT = 10;

/**
 * 最近の活動を取得
 */
export async function getRecentActivities(
  projectId: string,
  filteredTestSuiteIds?: string[],
  environmentId?: string
): Promise<RecentActivityItem[]> {
  const activities: RecentActivityItem[] = [];

  // テストスイートのwhere条件を構築
  const testSuiteWhere = filteredTestSuiteIds
    ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
    : { projectId, deletedAt: null };

  // 3種類のイベントを並行で取得
  const [recentExecutions, recentTestCaseUpdates, recentReviews] = await Promise.all([
    prisma.execution.findMany({
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
    }),
    prisma.testCaseHistory.findMany({
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
    }),
    prisma.review.findMany({
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
    }),
  ]);

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
