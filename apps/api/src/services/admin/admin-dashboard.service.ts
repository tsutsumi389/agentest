import { prisma } from '@agentest/db';
import { Redis } from 'ioredis';
import type {
  AdminDashboardStats,
  AdminDashboardUserStats,
  AdminDashboardOrgStats,
  AdminDashboardExecutionStats,
  AdminDashboardRevenueStats,
  AdminDashboardSystemHealth,
  SystemHealthStatus,
} from '@agentest/shared';
import { env } from '../../config/env.js';
import {
  getAdminDashboardCache,
  setAdminDashboardCache,
} from '../../lib/redis-store.js';

// 定数
const CACHE_TTL_SECONDS = 300; // 5分
const ACTIVE_DAYS = 30; // アクティブ判定用の日数

// サブスクリプションプランごとの月額料金（円）
const PLAN_PRICES = {
  FREE: 0,
  PRO: 980,
  TEAM: 4980,
  ENTERPRISE: 19800,
} as const;

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
    const [users, organizations, executions, revenue, systemHealth] =
      await Promise.all([
        this.getUserStats(),
        this.getOrgStats(),
        this.getExecutionStats(),
        this.getRevenueStats(),
        this.getSystemHealth(),
      ]);

    const stats: AdminDashboardStats = {
      users,
      organizations,
      executions,
      revenue,
      systemHealth,
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

    const [total, freeCount, proCount, newThisMonth, activeUsers] = await Promise.all([
      // 総ユーザー数
      prisma.user.count({
        where: { deletedAt: null },
      }),
      // FREEプランユーザー数
      prisma.user.count({
        where: { plan: 'FREE', deletedAt: null },
      }),
      // PROプランユーザー数
      prisma.user.count({
        where: { plan: 'PRO', deletedAt: null },
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
      byPlan: {
        free: freeCount,
        pro: proCount,
      },
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

    const [total, teamCount, enterpriseCount, newThisMonth, activeOrgs] = await Promise.all([
      // 総組織数
      prisma.organization.count({
        where: { deletedAt: null },
      }),
      // TEAMプラン組織数
      prisma.organization.count({
        where: { plan: 'TEAM', deletedAt: null },
      }),
      // ENTERPRISEプラン組織数
      prisma.organization.count({
        where: { plan: 'ENTERPRISE', deletedAt: null },
      }),
      // 当月新規組織数
      prisma.organization.count({
        where: {
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
      }),
      // アクティブ組織数（30日以内にプロジェクトの更新あり）
      prisma.organization.count({
        where: {
          deletedAt: null,
          projects: {
            some: {
              updatedAt: { gte: thirtyDaysAgo },
              deletedAt: null,
            },
          },
        },
      }),
    ]);

    return {
      total,
      byPlan: {
        team: teamCount,
        enterprise: enterpriseCount,
      },
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

  /**
   * 収益統計を取得
   */
  private async getRevenueStats(): Promise<AdminDashboardRevenueStats> {
    // アクティブなサブスクリプションを取得
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        plan: true,
        billingCycle: true,
      },
    });

    // MRRを計算
    let mrr = 0;
    for (const sub of activeSubscriptions) {
      const monthlyPrice = PLAN_PRICES[sub.plan] || 0;
      // 年払いの場合は12で割る
      if (sub.billingCycle === 'YEARLY') {
        mrr += Math.round(monthlyPrice * 12 / 12); // 年額を月額に換算
      } else {
        mrr += monthlyPrice;
      }
    }

    // 請求書ステータス別件数を取得
    const invoiceCounts = await prisma.invoice.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const invoices = {
      paid: 0,
      pending: 0,
      failed: 0,
    };

    for (const invoice of invoiceCounts) {
      const count = invoice._count.status;
      if (invoice.status === 'PAID') {
        invoices.paid = count;
      } else if (invoice.status === 'PENDING') {
        invoices.pending = count;
      } else if (invoice.status === 'FAILED') {
        invoices.failed = count;
      }
    }

    return {
      mrr,
      invoices,
    };
  }

  /**
   * システムヘルスを取得
   */
  private async getSystemHealth(): Promise<AdminDashboardSystemHealth> {
    const [api, database, redis, minio] = await Promise.all([
      this.checkApiHealth(),
      this.checkDatabaseHealth(),
      this.checkRedisHealth(),
      this.checkMinioHealth(),
    ]);

    return {
      api,
      database,
      redis,
      minio,
    };
  }

  /**
   * APIヘルスチェック
   */
  private async checkApiHealth(): Promise<SystemHealthStatus> {
    // APIは稼働中（このコードが実行されているので）
    return { status: 'healthy', latency: 0 };
  }

  /**
   * データベースヘルスチェック
   */
  private async checkDatabaseHealth(): Promise<SystemHealthStatus> {
    const start = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      return { status: 'unhealthy', error: (error as Error).message };
    }
  }

  /**
   * Redisヘルスチェック
   */
  private async checkRedisHealth(): Promise<SystemHealthStatus> {
    if (!env.REDIS_URL) {
      return { status: 'not_configured' };
    }

    const start = Date.now();
    const redis = new Redis(env.REDIS_URL);

    try {
      await redis.ping();
      await redis.quit();
      return { status: 'healthy', latency: Date.now() - start };
    } catch (error) {
      try {
        await redis.quit();
      } catch {
        // 無視
      }
      return { status: 'unhealthy', error: (error as Error).message };
    }
  }

  /**
   * MinIOヘルスチェック
   */
  private async checkMinioHealth(): Promise<SystemHealthStatus> {
    if (!env.S3_ENDPOINT) {
      return { status: 'not_configured' };
    }

    const start = Date.now();
    try {
      // MinIOのヘルスエンドポイントにリクエスト
      const response = await fetch(`${env.S3_ENDPOINT}/minio/health/live`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5秒タイムアウト
      });

      if (response.ok) {
        return { status: 'healthy', latency: Date.now() - start };
      } else {
        return { status: 'unhealthy', error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { status: 'unhealthy', error: (error as Error).message };
    }
  }
}
