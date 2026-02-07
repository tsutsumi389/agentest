/**
 * metrics-aggregation ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockCountActiveUsers, mockUpsertMetric, mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
      trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return {
    mockCountActiveUsers: vi.fn(),
    mockUpsertMetric: vi.fn(),
    mockLogger,
  };
});

vi.mock('../../lib/metrics-utils.js', () => ({
  countActiveUsers: mockCountActiveUsers,
  upsertMetric: mockUpsertMetric,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// モック設定後にインポート
import { runMetricsAggregation } from '../../jobs/metrics-aggregation.js';
import {
  getJSTYesterdayStart,
  getJSTStartOfDay,
  getJSTLastMonday,
  getJSTLastMonthStart,
  getJSTThisMonthStart,
} from '../../lib/date-utils.js';

describe('runMetricsAggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('DAU集計', () => {
    it('前日のアクティブユーザー数を集計する', async () => {
      // 2026-01-15 10:00:00 JST に実行（= 2026-01-15 01:00:00 UTC）
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(150);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      // 期待値を日付ユーティリティで計算
      const expectedYesterday = getJSTYesterdayStart(testTime);
      const expectedToday = getJSTStartOfDay(testTime);

      // countActiveUsersが前日の範囲で呼ばれることを確認
      expect(mockCountActiveUsers).toHaveBeenCalledWith(
        expectedYesterday,
        expectedToday
      );
    });

    it('DAUをActiveUserMetricテーブルに保存する', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(150);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      const expectedYesterday = getJSTYesterdayStart(testTime);

      // upsertMetricが正しく呼ばれることを確認
      expect(mockUpsertMetric).toHaveBeenCalledWith('DAY', expectedYesterday, 150);
    });

    it('DAU集計結果をログ出力する', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(150);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      // JST基準で前日の日付がログに出力される
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ date: '2026-01-14', count: 150 }),
        'DAU集計完了'
      );
    });
  });

  describe('WAU集計', () => {
    it('月曜日に実行された場合、前週のWAUを集計する', async () => {
      // 2026-01-19 10:00:00 JST (月曜日) に実行
      // JST 2026-01-19 10:00:00 = UTC 2026-01-19 01:00:00
      const testTime = new Date('2026-01-19T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(420);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      // 期待値を計算
      const thisMonday = getJSTLastMonday(testTime);
      const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);

      // WAU用のupsertMetricが呼ばれることを確認
      expect(mockUpsertMetric).toHaveBeenCalledWith('WEEK', lastMonday, 420);
    });

    it('月曜日以外に実行された場合、WAU集計はスキップされる', async () => {
      // 2026-01-15 10:00:00 JST (木曜日) に実行
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(150);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      // DAUのupsertMetricのみ呼ばれる（WAUは呼ばれない）
      expect(mockUpsertMetric).toHaveBeenCalledTimes(1);
      expect(mockUpsertMetric).toHaveBeenCalledWith(
        'DAY',
        expect.any(Date),
        150
      );
    });
  });

  describe('MAU集計', () => {
    it('月初に実行された場合、前月のMAUを集計する', async () => {
      // 2026-02-01 10:00:00 JST (月初) に実行
      const testTime = new Date('2026-02-01T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(980);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      // 期待値を計算
      const lastMonthStart = getJSTLastMonthStart(testTime);
      const thisMonthStart = getJSTThisMonthStart(testTime);

      // MAU用のcountActiveUsersが正しい範囲で呼ばれることを確認
      expect(mockCountActiveUsers).toHaveBeenCalledWith(
        lastMonthStart,
        thisMonthStart
      );

      // MAU用のupsertMetricが呼ばれることを確認
      expect(mockUpsertMetric).toHaveBeenCalledWith(
        'MONTH',
        lastMonthStart,
        980
      );
    });

    it('月初以外に実行された場合、MAU集計はスキップされる', async () => {
      // 2026-01-15 10:00:00 JST (月中) に実行
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(150);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      // DAUのupsertMetricのみ呼ばれる（MAUは呼ばれない）
      const granularities = mockUpsertMetric.mock.calls.map((call) => call[0]);
      expect(granularities).not.toContain('MONTH');
    });
  });

  describe('複合条件', () => {
    it('月曜日かつ月初の場合、DAU/WAU/MAU全てを集計する', async () => {
      // 2026-06-01 10:00:00 JST (月曜日かつ月初) に実行
      const testTime = new Date('2026-06-01T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(100);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsAggregation();

      // DAU, WAU, MAU全てのupsertMetricが呼ばれることを確認
      expect(mockUpsertMetric).toHaveBeenCalledTimes(3);

      const granularities = mockUpsertMetric.mock.calls.map((call) => call[0]);
      expect(granularities).toContain('DAY');
      expect(granularities).toContain('WEEK');
      expect(granularities).toContain('MONTH');
    });
  });
});
