import { prisma } from '@agentest/db';
import type { ResultDistribution } from '@agentest/shared';

// 統計対象の日数
const STATS_DAYS = 30;

/**
 * 実行結果の分布を取得
 */
export async function getResultDistribution(
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
