import { prisma } from '@agentest/db';
import type {
  ExecutionStatusSuites,
  FailingTestSuiteItem,
  SkippedTestSuiteItem,
  NeverExecutedTestSuiteItem,
  InProgressTestSuiteItem,
  PaginatedList,
} from '@agentest/shared';

// テスト実行状況のデフォルト取得件数
const EXECUTION_STATUS_DEFAULT_LIMIT = 10;

/**
 * テストスイートのwhere条件を構築するヘルパー
 */
function buildTestSuiteWhere(projectId: string, filteredTestSuiteIds?: string[]) {
  return filteredTestSuiteIds
    ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
    : { projectId, deletedAt: null };
}

/**
 * テスト実行状況（テストスイート単位）を取得
 */
export async function getExecutionStatusSuites(
  projectId: string,
  filteredTestSuiteIds?: string[],
  environmentId?: string,
  limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
): Promise<ExecutionStatusSuites> {
  const testSuiteWhere = buildTestSuiteWhere(projectId, filteredTestSuiteIds);

  // 最新実行を持つテストスイートと未実行テストスイートを並行で取得（1+1クエリ）
  const [suitesWithExecution, neverExecutedSuites] = await Promise.all([
    prisma.testSuite.findMany({
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
    }),
    getNeverExecutedSuites(projectId, filteredTestSuiteIds, limit),
  ]);

  // 1回のクエリ結果から3種類のリストを同時に構築
  const failingItems: FailingTestSuiteItem[] = [];
  const skippedItems: SkippedTestSuiteItem[] = [];
  const inProgressItems: InProgressTestSuiteItem[] = [];

  for (const suite of suitesWithExecution) {
    const lastExecution = suite.executions[0];
    if (!lastExecution) continue;

    const results = lastExecution.expectedResults;
    const totalExpectedResults = results.length;

    // 各ステータスのカウントを1回のループで集計
    let failCount = 0;
    let skippedCount = 0;
    let pendingCount = 0;
    for (const r of results) {
      if (r.status === 'FAIL') failCount++;
      else if (r.status === 'SKIPPED') skippedCount++;
      else if (r.status === 'PENDING') pendingCount++;
    }

    const base = {
      testSuiteId: suite.id,
      testSuiteName: suite.name,
      lastExecutionId: lastExecution.id,
      lastExecutedAt: lastExecution.createdAt,
      environment: lastExecution.environment,
      totalExpectedResults,
    };

    if (failCount > 0) {
      failingItems.push({ ...base, failCount });
    }
    if (skippedCount > 0) {
      skippedItems.push({ ...base, skippedCount });
    }
    if (pendingCount > 0) {
      inProgressItems.push({ ...base, pendingCount });
    }
  }

  // 各リストをソートしてlimit件に絞る
  failingItems.sort((a, b) => b.failCount - a.failCount);
  skippedItems.sort((a, b) => b.skippedCount - a.skippedCount);
  inProgressItems.sort((a, b) => b.pendingCount - a.pendingCount);

  return {
    failingSuites: {
      items: failingItems.slice(0, limit),
      total: failingItems.length,
    },
    skippedSuites: {
      items: skippedItems.slice(0, limit),
      total: skippedItems.length,
    },
    neverExecutedSuites,
    inProgressSuites: {
      items: inProgressItems.slice(0, limit),
      total: inProgressItems.length,
    },
  };
}

/**
 * 未実行テストスイートを取得
 * 一度も実行されていないテストスイート
 */
async function getNeverExecutedSuites(
  projectId: string,
  filteredTestSuiteIds?: string[],
  limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
): Promise<PaginatedList<NeverExecutedTestSuiteItem>> {
  const testSuiteWhere = buildTestSuiteWhere(projectId, filteredTestSuiteIds);

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
