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
 * テスト実行状況（テストスイート単位）を取得
 */
export async function getExecutionStatusSuites(
  projectId: string,
  filteredTestSuiteIds?: string[],
  environmentId?: string,
  limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
): Promise<ExecutionStatusSuites> {
  const [failingSuites, skippedSuites, neverExecutedSuites, inProgressSuites] = await Promise.all([
    getFailingSuites(projectId, filteredTestSuiteIds, environmentId, limit),
    getSkippedSuites(projectId, filteredTestSuiteIds, environmentId, limit),
    getNeverExecutedSuites(projectId, filteredTestSuiteIds, limit),
    getInProgressSuites(projectId, filteredTestSuiteIds, environmentId, limit),
  ]);

  return {
    failingSuites,
    skippedSuites,
    neverExecutedSuites,
    inProgressSuites,
  };
}

/**
 * テストスイートのwhere条件を構築するヘルパー
 */
function buildTestSuiteWhere(projectId: string, filteredTestSuiteIds?: string[]) {
  return filteredTestSuiteIds
    ? { id: { in: filteredTestSuiteIds }, projectId, deletedAt: null }
    : { projectId, deletedAt: null };
}

/**
 * 失敗中テストスイートを取得
 * 最終実行の期待結果にFAILを含むテストスイート
 */
async function getFailingSuites(
  projectId: string,
  filteredTestSuiteIds?: string[],
  environmentId?: string,
  limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
): Promise<PaginatedList<FailingTestSuiteItem>> {
  const testSuiteWhere = buildTestSuiteWhere(projectId, filteredTestSuiteIds);

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

    const failCount = lastExecution.expectedResults.filter((r) => r.status === 'FAIL').length;

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
async function getSkippedSuites(
  projectId: string,
  filteredTestSuiteIds?: string[],
  environmentId?: string,
  limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
): Promise<PaginatedList<SkippedTestSuiteItem>> {
  const testSuiteWhere = buildTestSuiteWhere(projectId, filteredTestSuiteIds);

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

    const skippedCount = lastExecution.expectedResults.filter((r) => r.status === 'SKIPPED').length;

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

/**
 * 実行中テストスイートを取得
 * 最終実行の期待結果にPENDINGを含むテストスイート
 */
async function getInProgressSuites(
  projectId: string,
  filteredTestSuiteIds?: string[],
  environmentId?: string,
  limit: number = EXECUTION_STATUS_DEFAULT_LIMIT
): Promise<PaginatedList<InProgressTestSuiteItem>> {
  const testSuiteWhere = buildTestSuiteWhere(projectId, filteredTestSuiteIds);

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

    const pendingCount = lastExecution.expectedResults.filter((r) => r.status === 'PENDING').length;

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
