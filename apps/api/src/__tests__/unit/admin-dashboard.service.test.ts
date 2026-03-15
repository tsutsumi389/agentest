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
        users: { total: 100, newThisMonth: 10, activeUsers: 50 },
        organizations: { total: 20, newThisMonth: 2, activeOrgs: 10 },
        executions: { totalThisMonth: 500, passCount: 400, failCount: 100, passRate: 80 },
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

      const result = await service.getDashboard();

      expect(result.users).toBeDefined();
      expect(result.organizations).toBeDefined();
      expect(result.executions).toBeDefined();
      expect(result.fetchedAt).toBeDefined();

      expect(setAdminDashboardCache).toHaveBeenCalledTimes(1);
    });

    it('ユーザー統計が正しく集計される', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      // ユーザー統計のモック
      const mockCount = vi.mocked(prisma.user.count);
      mockCount
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(15) // newThisMonth
        .mockResolvedValueOnce(60); // activeUsers

      // 他のモック
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([]);

      const result = await service.getDashboard();

      expect(result.users).toMatchObject({
        total: 100,
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
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(5) // newThisMonth
        .mockResolvedValueOnce(30); // activeOrgs

      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([]);

      const result = await service.getDashboard();

      expect(result.organizations).toMatchObject({
        total: 50,
        newThisMonth: 5,
        activeOrgs: 30,
      });
    });

    it('実行統計の成功率が正しく計算される', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

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

    it('判定済み結果がない場合は成功率が0になる', async () => {
      vi.mocked(getAdminDashboardCache).mockResolvedValue(null);
      vi.mocked(setAdminDashboardCache).mockResolvedValue(true);

      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.organization.count).mockResolvedValue(0);

      // PASSもFAILもない場合
      vi.mocked(prisma.executionExpectedResult.groupBy).mockResolvedValue([
        { status: 'PENDING', _count: { status: 10 } },
      ] as never);

      const result = await service.getDashboard();

      expect(result.executions.passRate).toBe(0);
    });
  });
});
