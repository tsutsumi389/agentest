import { prisma } from '@agentest/db';
import type {
  AdminDashboardStats,
  AdminDashboardUserStats,
  AdminDashboardOrgStats,
  AdminDashboardExecutionStats,
} from '@agentest/shared';
import {
  getAdminDashboardCache,
  setAdminDashboardCache,
} from '../../lib/redis-store.js';

// 定数
const CACHE_TTL_SECONDS = 300; // 5分
const ACTIVE_DAYS = 30; // アクティブ判定用の日数

/**
 * 管理者ダッシュボードサービス
 */
export class AdminDashboardService {
  /**
   * ダッシュボード統計を取得
   */
  async getDashboard(): Promise<AdminDashboardStats> {
    // キャッシュをチェック
    const cached = await getAdminDashboardCache<AdminDashboardStats>();
    if (cached) {
      return cached;
    }

    // 並列でデータを取得
    const [users, organizations, executions] =
      await Promise.all([
        this.getUserStats(),
        this.getOrgStats(),
        this.getExecutionStats(),
      ]);

    const stats: AdminDashboardStats = {
      users,
      organizations,
      executions,
      fetchedAt: new Date().toISOString(),
    };

    // キャッシュに保存
    await setAdminDashboardCache(stats, CACHE_TTL_SECONDS);

    return stats;
  }

  /**
   * ユーザー統計を取得
   */
  private async getUserStats(): Promise<AdminDashboardUserStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

    const [total, newThisMonth, activeUsers] = await Promise.all([
      // 総ユーザー数
      prisma.user.count({
        where: { deletedAt: null },
      }),
      // 当月新規ユーザー数
      prisma.user.count({
        where: {
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
      // アクティブユーザー数（30日以内にセッションがアクティブ）
      prisma.user.count({
        where: {
          deletedAt: null,
          sessions: {
            some: {
              lastActiveAt: { gte: thirtyDaysAgo },
              revokedAt: null,
            },
          },
        },
      }),
    ]);

    return {
      total,
      newThisMonth,
      activeUsers,
    };
  }

  /**
   * 組織統計を取得
   */
  private async getOrgStats(): Promise<AdminDashboardOrgStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);

    const [total, newThisMonth, activeOrgs] = await Promise.all([
      // 総組織数
      prisma.organization.count({
        where: { deletedAt: null },
      }),
      // 当月新規組織数
      prisma.organization.count({
        where: {
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
      // アクティブ組織数（30日以内にテスト実行があった組織）
      prisma.organization.count({
        where: {
          deletedAt: null,
          projects: {
            some: {
              deletedAt: null,
              testSuites: {
                some: {
                  executions: {
                    some: {
                      createdAt: { gte: thirtyDaysAgo },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      total,
      newThisMonth,
      activeOrgs,
    };
  }

  /**
   * テスト実行統計を取得
   */
  private async getExecutionStats(): Promise<AdminDashboardExecutionStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 当月の期待結果のステータス別カウントを取得
    const resultCounts = await prisma.executionExpectedResult.groupBy({
      by: ['status'],
      where: {
        execution: {
          createdAt: { gte: startOfMonth },
        },
      },
      _count: { status: true },
    });

    // 各ステータスのカウントを抽出
    let passCount = 0;
    let failCount = 0;
    let totalThisMonth = 0;

    for (const result of resultCounts) {
      const count = result._count.status;
      totalThisMonth += count;
      if (result.status === 'PASS') {
        passCount = count;
      } else if (result.status === 'FAIL') {
        failCount = count;
      }
    }

    // 成功率を計算（PASS + FAIL のうち PASS の割合）
    const judgedCount = passCount + failCount;
    const passRate = judgedCount > 0 ? Math.round((passCount / judgedCount) * 100 * 10) / 10 : 0;

    return {
      totalThisMonth,
      passCount,
      failCount,
      passRate,
    };
  }
}
