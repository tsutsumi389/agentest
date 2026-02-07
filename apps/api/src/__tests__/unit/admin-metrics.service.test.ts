import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ActiveUserMetricsResponse } from '@agentest/shared';
import type { MetricGranularity } from '@agentest/db';

// Prismaをモック
vi.mock('@agentest/db', () => ({
  prisma: {
    activeUserMetric: {
      findMany: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
  },
}));

// redis-storeをモック
vi.mock('../../lib/redis-store.js', () => ({
  getAdminMetricsCache: vi.fn(),
  setAdminMetricsCache: vi.fn(),
}));

import { AdminMetricsService } from '../../services/admin/admin-metrics.service.js';
import { prisma } from '@agentest/db';
import { getAdminMetricsCache, setAdminMetricsCache } from '../../lib/redis-store.js';

describe('AdminMetricsService', () => {
  let service: AdminMetricsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminMetricsService();
    // デフォルトでキャッシュなし
    vi.mocked(getAdminMetricsCache).mockResolvedValue(null);
    vi.mocked(setAdminMetricsCache).mockResolvedValue(true);
  });

  afterEach(() => {
    // システム時刻のモックをリセット
    vi.useRealTimers();
  });

  describe('getActiveUserMetrics', () => {
    it('キャッシュがある場合はキャッシュを返す', async () => {
      const cachedResponse: ActiveUserMetricsResponse = {
        granularity: 'day',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
        data: [
          { date: '2026-01-01', count: 100 },
          { date: '2026-01-02', count: 120 },
        ],
        summary: {
          average: 110,
          max: 120,
          min: 100,
          changeRate: 5.5,
        },
        fetchedAt: '2026-02-01T00:00:00.000Z',
      };

      vi.mocked(getAdminMetricsCache).mockResolvedValue(cachedResponse);

      const result = await service.getActiveUserMetrics({
        granularity: 'day',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result).toEqual(cachedResponse);
      expect(getAdminMetricsCache).toHaveBeenCalledTimes(1);
      expect(prisma.activeUserMetric.findMany).not.toHaveBeenCalled();
    });

    it('キャッシュがない場合はDBから取得してキャッシュに保存する', async () => {
      const mockMetrics = [
        { id: '1', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-01'), userCount: 100, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-02'), userCount: 120, createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue(mockMetrics);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({
        granularity: 'day',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-02T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result.granularity).toBe('day');
      expect(result.data).toHaveLength(2);
      expect(setAdminMetricsCache).toHaveBeenCalledTimes(1);
    });

    it('日次粒度でデータを取得できる', async () => {
      const mockMetrics = [
        { id: '1', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-15'), userCount: 150, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-16'), userCount: 142, createdAt: new Date(), updatedAt: new Date() },
        { id: '3', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-17'), userCount: 98, createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue(mockMetrics);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({
        granularity: 'day',
        startDate: '2026-01-15T00:00:00.000Z',
        endDate: '2026-01-17T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result.granularity).toBe('day');
      expect(result.data).toEqual([
        { date: '2026-01-15', count: 150 },
        { date: '2026-01-16', count: 142 },
        { date: '2026-01-17', count: 98 },
      ]);
    });

    it('週次粒度でデータを取得できる', async () => {
      const mockMetrics = [
        { id: '1', granularity: 'WEEK' as MetricGranularity, periodStart: new Date('2026-01-06'), userCount: 420, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', granularity: 'WEEK' as MetricGranularity, periodStart: new Date('2026-01-13'), userCount: 450, createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue(mockMetrics);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({
        granularity: 'week',
        startDate: '2026-01-06T00:00:00.000Z',
        endDate: '2026-01-19T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result.granularity).toBe('week');
      expect(result.data).toEqual([
        { date: '2026-01-06', count: 420 },
        { date: '2026-01-13', count: 450 },
      ]);
    });

    it('月次粒度でデータを取得できる', async () => {
      const mockMetrics = [
        { id: '1', granularity: 'MONTH' as MetricGranularity, periodStart: new Date('2025-12-01'), userCount: 950, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', granularity: 'MONTH' as MetricGranularity, periodStart: new Date('2026-01-01'), userCount: 980, createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue(mockMetrics);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({
        granularity: 'month',
        startDate: '2025-12-01T00:00:00.000Z',
        endDate: '2026-01-31T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result.granularity).toBe('month');
      expect(result.data).toEqual([
        { date: '2025-12-01', count: 950 },
        { date: '2026-01-01', count: 980 },
      ]);
    });

    it('当日データが含まれる場合はリアルタイムデータを取得する', async () => {
      // 現在日時を固定
      const now = new Date('2026-01-15T12:00:00.000Z');
      vi.setSystemTime(now);

      // 過去の集計データ
      const mockMetrics = [
        { id: '1', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-14'), userCount: 100, createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue(mockMetrics);
      // 当日のリアルタイムカウント
      vi.mocked(prisma.user.count).mockResolvedValue(125);

      const result = await service.getActiveUserMetrics({
        granularity: 'day',
        startDate: '2026-01-14T00:00:00.000Z',
        endDate: '2026-01-15T23:59:59.000Z',
        timezone: 'Asia/Tokyo',
      });

      // 当日データがリアルタイムで取得されることを確認
      expect(prisma.user.count).toHaveBeenCalled();
      expect(result.data).toContainEqual({ date: '2026-01-15', count: 125 });
    });

    it('サマリーが正しく計算される', async () => {
      const mockMetrics = [
        { id: '1', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-01'), userCount: 100, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-02'), userCount: 150, createdAt: new Date(), updatedAt: new Date() },
        { id: '3', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-03'), userCount: 80, createdAt: new Date(), updatedAt: new Date() },
      ];

      // 現在の期間データ
      vi.mocked(prisma.activeUserMetric.findMany)
        .mockResolvedValueOnce(mockMetrics)
        // 前期間データ（changeRate計算用）
        .mockResolvedValueOnce([
          { id: '4', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2025-12-29'), userCount: 90, createdAt: new Date(), updatedAt: new Date() },
          { id: '5', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2025-12-30'), userCount: 100, createdAt: new Date(), updatedAt: new Date() },
          { id: '6', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2025-12-31'), userCount: 110, createdAt: new Date(), updatedAt: new Date() },
        ]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({
        granularity: 'day',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-03T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result.summary.average).toBe(110); // (100 + 150 + 80) / 3 = 110
      expect(result.summary.max).toBe(150);
      expect(result.summary.min).toBe(80);
      // 前期間平均: (90 + 100 + 110) / 3 = 100
      // 変化率: (110 - 100) / 100 * 100 = 10%
      expect(result.summary.changeRate).toBe(10);
    });

    it('データがない場合はサマリーが0で返される', async () => {
      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({
        granularity: 'day',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-03T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result.summary.average).toBe(0);
      expect(result.summary.max).toBe(0);
      expect(result.summary.min).toBe(0);
      expect(result.summary.changeRate).toBeNull();
    });

    it('前期間データがない場合はchangeRateがnullになる', async () => {
      const mockMetrics = [
        { id: '1', granularity: 'DAY' as MetricGranularity, periodStart: new Date('2026-01-01'), userCount: 100, createdAt: new Date(), updatedAt: new Date() },
      ];

      vi.mocked(prisma.activeUserMetric.findMany)
        .mockResolvedValueOnce(mockMetrics)
        // 前期間データなし
        .mockResolvedValueOnce([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({
        granularity: 'day',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-01T00:00:00.000Z',
        timezone: 'Asia/Tokyo',
      });

      expect(result.summary.changeRate).toBeNull();
    });

    it('デフォルトパラメータで30日間の日次データを取得する', async () => {
      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      const result = await service.getActiveUserMetrics({ granularity: 'day', timezone: 'Asia/Tokyo' });

      expect(result.granularity).toBe('day');
      expect(result.timezone).toBe('Asia/Tokyo');
      // デフォルト期間が設定されていることを確認
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });

    it('当日データを含む場合は短いTTLでキャッシュされる', async () => {
      const now = new Date('2026-01-15T12:00:00.000Z');
      vi.setSystemTime(now);

      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(100);

      await service.getActiveUserMetrics({
        granularity: 'day',
        timezone: 'Asia/Tokyo',
        endDate: '2026-01-15T23:59:59.000Z',
      });

      // キャッシュが60秒（当日データ込み）で設定されることを確認
      expect(setAdminMetricsCache).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        60
      );
    });

    it('過去データのみの場合は長いTTLでキャッシュされる', async () => {
      const now = new Date('2026-01-20T12:00:00.000Z');
      vi.setSystemTime(now);

      vi.mocked(prisma.activeUserMetric.findMany).mockResolvedValue([]);
      vi.mocked(prisma.user.count).mockResolvedValue(0);

      await service.getActiveUserMetrics({
        granularity: 'day',
        timezone: 'Asia/Tokyo',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-10T00:00:00.000Z',
      });

      // キャッシュが300秒（過去データ用）で設定されることを確認
      expect(setAdminMetricsCache).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        300
      );
    });
  });
});
