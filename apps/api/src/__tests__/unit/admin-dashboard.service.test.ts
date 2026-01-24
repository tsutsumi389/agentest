import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AdminDashboardStats } from '@agentest/shared';

// Prismaをモック
vi.mock('@agentest/db', () => ({
  prisma: {
    user: {
      count: vi.fn(),
    },
    organization: {
      count: vi.fn(),
    },
    executionExpectedResult: {
      groupBy: vi.fn(),
    },
    subscription: {
      findMany: vi.fn(),
    },
    invoice: {
      groupBy: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// envをモック
vi.mock('../../config/env.js', () => ({
  env: {
    REDIS_URL: undefined,
    S3_ENDPOINT: undefined,
  },
}));

// redis-storeをモック
vi.mock('../../lib/redis-store.js', () => ({
  getAdminDashboardCache: vi.fn(),
  setAdminDashboardCache: vi.fn(),
}));

import { AdminDashboardService } from '../../services/admin/admin-dashboard.service.js';
import { prisma } from '@agentest/db';
import { getAdminDashboardCache, setAdminDashboardCache } from '../../lib/redis-store.js';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminDashboardService();
  });

  describe('getDashboard', () => {
    it('キャッシュがある場合はキャッシュを返す', async () => {
      const cachedStats: AdminDashboardStats = {
        users: { total: 100, byPlan: { free: 80, pro: 20 }, newThisMonth: 10, activeUsers: 50 },
        organizations: { total: 20, byPlan: { team: 15, enterprise: 5 }, newThisMonth: 2, activeOrgs: 10 },
        executions: { totalThisMonth: 500, passCount: 400, failCount: 100, passRate: 80 },
        revenue: { mrr: 50000, invoices: { paid: 30, pending: 5, failed: 2 } },
        systemHealth: {
          api: { status: 'healthy', latency: 0 },
          database: { status: 'healthy', latency: 5 },
          redis: { status: 'not_configured' },
          minio: { status: 'not_configured' },
        },
        fetchedAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(getAdminDashboardCache).mockResolvedValue(cachedStats);

      const result = await service.getDashboard();

      expect(result).toEqual(cachedStats);
      expect(getAdminDashboardCache).toHaveBeenCalledTimes(1);
      // Prismaクエリは呼ばれない
      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('キャッシュがない場合はDBから取得してキャッシュに保存する', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      // Prismaモックの設定
      vi.mocked(prisma.user.count).mockResolvedValue(100);
      vi.mocked(prisma.organization.count).mockResolvedValue(20);
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getDashboard();

      expect(result.users).toBeDefined();
      expect(result.organizations).toBeDefined();
      expect(result.executions).toBeDefined();
      expect(result.revenue).toBeDefined();
      expect(result.systemHealth).toBeDefined();
      expect(result.fetchedAt).toBeDefined();

      expect(setAdminDashboardCache).toHaveBeenCalledTimes(1);
    });

    it('ユーザー統計が正しく集計される', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      // ユーザー統計のモック
      const mockCount = vi.mocked(prisma.user.count);
      mockCount
        .mockResolvedValueOnce(100)  // total
        .mockResolvedValueOnce(70)   // free
        .mockResolvedValueOnce(30)   // pro
        .mockResolvedValueOnce(15)   // newThisMonth
        .mockResolvedValueOnce(60);  // activeUsers

      // 他のモック
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getDashboard();

      expect(result.users).toEqual({
        total: 100,
        byPlan: { free: 70, pro: 30 },
        newThisMonth: 15,
        activeUsers: 60,
      });
    });

    it('組織統計が正しく集計される', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      // ユーザー統計のモック
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      // 組織統計のモック
      const mockOrgCount = vi.mocked(prisma.organization.count);
      mockOrgCount
        .mockResolvedValueOnce(50)   // total
        .mockResolvedValueOnce(35)   // team
        .mockResolvedValueOnce(15)   // enterprise
        .mockResolvedValueOnce(5)    // newThisMonth
        .mockResolvedValueOnce(30);  // activeOrgs

      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getDashboard();

      expect(result.organizations).toEqual({
        total: 50,
        byPlan: { team: 35, enterprise: 15 },
        newThisMonth: 5,
        activeOrgs: 30,
      });
    });

    it('実行統計の成功率が正しく計算される', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      // 実行結果のモック: 80 PASS, 20 FAIL
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([
        { status: 'PASS', _count: { status: 80 } },
        { status: 'FAIL', _count: { status: 20 } },
        { status: 'PENDING', _count: { status: 10 } },
        { status: 'SKIPPED', _count: { status: 5 } },
      ] as never);

      const result = await service.getDashboard();

      expect(result.executions.totalThisMonth).toBe(115);
      expect(result.executions.passCount).toBe(80);
      expect(result.executions.failCount).toBe(20);
      expect(result.executions.passRate).toBe(80); // 80 / (80 + 20) * 100
    });

    it('収益統計のMRRが正しく計算される', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      // アクティブなサブスクリプション
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([
        { plan: 'PRO', billingCycle: 'MONTHLY' },
        { plan: 'PRO', billingCycle: 'YEARLY' },
        { plan: 'TEAM', billingCycle: 'MONTHLY' },
        { plan: 'ENTERPRISE', billingCycle: 'MONTHLY' },
      ] as never);

      // インボイス統計
      vi.mocked(prisma.invoice.groupBy).mockResolvedValue([
        { status: 'PAID', _count: { status: 10 } },
        { status: 'PENDING', _count: { status: 3 } },
        { status: 'FAILED', _count: { status: 1 } },
      ] as never);

      const result = await service.getDashboard();

      // MRR計算: PRO(980) + PRO(980) + TEAM(4980) + ENTERPRISE(19800) = 26740
      expect(result.revenue.mrr).toBe(26740);
      expect(result.revenue.invoices.paid).toBe(10);
      expect(result.revenue.invoices.pending).toBe(3);
      expect(result.revenue.invoices.failed).toBe(1);
    });

    it('システムヘルスが正しく返される', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      const result = await service.getDashboard();

      expect(result.systemHealth.api.status).toBe('healthy');
      expect(result.systemHealth.database.status).toBe('healthy');
      // Redis/MinIOは未設定なのでnot_configured
      expect(result.systemHealth.redis.status).toBe('not_configured');
      expect(result.systemHealth.minio.status).toBe('not_configured');
    });

    it('判定済み結果がない場合は成功率が0になる', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.subscription.findMany).mockResolvedValue([]);
      vi.mocked(prisma.invoice.groupBy).mockResolvedValue([]);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      // PASSもFAILもない場合
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([
        { status: 'PENDING', _count: { status: 10 } },
      ] as never);

      const result = await service.getDashboard();

      expect(result.executions.passRate).toBe(0);
    });
  });
});
