import { prisma } from '@agentest/db';
import { NotFoundError } from '@agentest/shared';
import type {
  ProjectDashboardStats,
  ProjectDashboardSummary,
  DashboardFilterParams,
} from '@agentest/shared';

import { getResultDistribution } from './dashboard/result-distribution.js';
import { getRecentActivities } from './dashboard/recent-activities.js';
import { getExecutionStatusSuites } from './dashboard/execution-status.js';

/**
 * プロジェクトダッシュボードサービス
 */
export class ProjectDashboardService {
  /**
   * プロジェクトダッシュボード統計を取得
   */
  async getDashboard(
    projectId: string,
    filters?: DashboardFilterParams
  ): Promise<ProjectDashboardStats> {
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
        getResultDistribution(projectId, filteredTestSuiteIds, filters?.environmentId),
        getExecutionStatusSuites(projectId, filteredTestSuiteIds, filters?.environmentId),
        getRecentActivities(projectId, filteredTestSuiteIds, filters?.environmentId),
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
}
