/**
 * metrics-aggregation ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      count: vi.fn(),
    },
    activeUserMetric: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

// モック設定後にインポート
import { runMetricsAggregation } from '../../jobs/metrics-aggregation.js';

describe('runMetricsAggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DAU集計', () => {
    it('前日のアクティブユーザー数を集計する', async () => {
      // 2026-01-15 10:00:00 に実行
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // user.countが前日の範囲で呼ばれることを確認
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          sessions: {
            some: {
              lastActiveAt: {
                gte: new Date('2026-01-14T00:00:00.000Z'),
                lt: new Date('2026-01-15T00:00:00.000Z'),
              },
              revokedAt: null,
            },
          },
        },
      });
    });

    it('DAUをActiveUserMetricテーブルに保存する', async () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // upsertが正しく呼ばれることを確認
      expect(mockPrisma.activeUserMetric.upsert).toHaveBeenCalledWith({
        where: {
          granularity_periodStart: {
            granularity: 'DAY',
            periodStart: new Date('2026-01-14T00:00:00.000Z'),
          },
        },
        create: {
          granularity: 'DAY',
          periodStart: new Date('2026-01-14T00:00:00.000Z'),
          userCount: 150,
        },
        update: { userCount: 150 },
      });
    });

    it('DAU集計結果をログ出力する', async () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      expect(console.log).toHaveBeenCalledWith('DAU 2026-01-14: 150');
    });
  });

  describe('WAU集計', () => {
    it('月曜日に実行された場合、前週のWAUを集計する', async () => {
      // 2026-01-19 (月曜日) に実行
      vi.setSystemTime(new Date('2026-01-19T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(420);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // WAU用のupsertが呼ばれることを確認（前週の月曜～日曜）
      expect(mockPrisma.activeUserMetric.upsert).toHaveBeenCalledWith({
        where: {
          granularity_periodStart: {
            granularity: 'WEEK',
            periodStart: new Date('2026-01-12T00:00:00.000Z'),
          },
        },
        create: {
          granularity: 'WEEK',
          periodStart: new Date('2026-01-12T00:00:00.000Z'),
          userCount: 420,
        },
        update: { userCount: 420 },
      });
    });

    it('月曜日以外に実行された場合、WAU集計はスキップされる', async () => {
      // 2026-01-15 (水曜日) に実行
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // DAUのupsertのみ呼ばれる（WAUは呼ばれない）
      expect(mockPrisma.activeUserMetric.upsert).toHaveBeenCalledTimes(1);
      expect(mockPrisma.activeUserMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            granularity_periodStart: {
              granularity: 'DAY',
              periodStart: expect.any(Date),
            },
          },
        })
      );
    });
  });

  describe('MAU集計', () => {
    it('月初に実行された場合、前月のMAUを集計する', async () => {
      // 2026-02-01 (月初) に実行
      vi.setSystemTime(new Date('2026-02-01T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(980);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // MAU用のupsertが呼ばれることを確認（前月1日～末日）
      expect(mockPrisma.activeUserMetric.upsert).toHaveBeenCalledWith({
        where: {
          granularity_periodStart: {
            granularity: 'MONTH',
            periodStart: new Date('2026-01-01T00:00:00.000Z'),
          },
        },
        create: {
          granularity: 'MONTH',
          periodStart: new Date('2026-01-01T00:00:00.000Z'),
          userCount: 980,
        },
        update: { userCount: 980 },
      });
    });

    it('月初以外に実行された場合、MAU集計はスキップされる', async () => {
      // 2026-01-15 (月中) に実行
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // DAUのupsertのみ呼ばれる（MAUは呼ばれない）
      const calls = mockPrisma.activeUserMetric.upsert.mock.calls;
      const granularities = calls.map(
        (call) => call[0].where.granularity_periodStart.granularity
      );
      expect(granularities).not.toContain('MONTH');
    });
  });

  describe('複合条件', () => {
    it('月曜日かつ月初の場合、DAU/WAU/MAU全てを集計する', async () => {
      // 2026-06-01 (月曜日かつ月初) に実行
      vi.setSystemTime(new Date('2026-06-01T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(100);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // DAU, WAU, MAU全てのupsertが呼ばれることを確認
      expect(mockPrisma.activeUserMetric.upsert).toHaveBeenCalledTimes(3);

      const granularities = mockPrisma.activeUserMetric.upsert.mock.calls.map(
        (call) => call[0].where.granularity_periodStart.granularity
      );
      expect(granularities).toContain('DAY');
      expect(granularities).toContain('WEEK');
      expect(granularities).toContain('MONTH');
    });
  });

  describe('削除済みユーザー除外', () => {
    it('deletedAtがnullのユーザーのみをカウント対象とする', async () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // deletedAt: nullの条件が含まれていることを確認
      expect(mockPrisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        })
      );
    });
  });

  describe('セッション条件', () => {
    it('revokedAtがnullのセッションのみをカウント対象とする', async () => {
      vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'));

      mockPrisma.user.count.mockResolvedValue(150);
      mockPrisma.activeUserMetric.upsert.mockResolvedValue({});

      await runMetricsAggregation();

      // revokedAt: nullの条件が含まれていることを確認
      expect(mockPrisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sessions: {
              some: expect.objectContaining({
                revokedAt: null,
              }),
            },
          }),
        })
      );
    });
  });
});
