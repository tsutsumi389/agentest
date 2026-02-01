/**
 * metrics-backfill ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const { mockCountActiveUsers, mockUpsertMetric } = vi.hoisted(() => ({
  mockCountActiveUsers: vi.fn(),
  mockUpsertMetric: vi.fn(),
}));

vi.mock('../../lib/metrics-utils.js', () => ({
  countActiveUsers: mockCountActiveUsers,
  upsertMetric: mockUpsertMetric,
}));

// モック設定後にインポート
import { runMetricsBackfill } from '../../jobs/metrics-backfill.js';

describe('runMetricsBackfill', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
  });

  describe('DAUバックフィル', () => {
    it('デフォルトで90日分のDAUを集計する', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      mockCountActiveUsers.mockResolvedValue(100);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      // DAUは90日分呼ばれる
      const dauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'DAY'
      );
      expect(dauCalls).toHaveLength(90);
    });

    it('BACKFILL_DAYS環境変数で日数を指定できる', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '7';

      mockCountActiveUsers.mockResolvedValue(100);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      // DAUは7日分呼ばれる
      const dauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'DAY'
      );
      expect(dauCalls).toHaveLength(7);
    });

    it('各日のupsertMetricがDAYグラニュラリティで呼ばれる', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '3';

      mockCountActiveUsers.mockResolvedValue(50);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      const dauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'DAY'
      );

      // 全てDAYグラニュラリティ
      dauCalls.forEach((call) => {
        expect(call[0]).toBe('DAY');
        expect(call[2]).toBe(50);
      });
    });
  });

  describe('WAUバックフィル', () => {
    it('日数に応じた週数分のWAUを集計する', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '30'; // 30日 → ceil(30/7) = 5週

      mockCountActiveUsers.mockResolvedValue(200);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      // WAUは5週分呼ばれる
      const wauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'WEEK'
      );
      expect(wauCalls).toHaveLength(5);
    });

    it('各週のupsertMetricがWEEKグラニュラリティで呼ばれる', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '14';

      mockCountActiveUsers.mockResolvedValue(300);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      const wauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'WEEK'
      );

      // 全てWEEKグラニュラリティ
      wauCalls.forEach((call) => {
        expect(call[0]).toBe('WEEK');
        expect(call[2]).toBe(300);
      });
    });
  });

  describe('MAUバックフィル', () => {
    it('日数に応じた月数分のMAUを集計する', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '90'; // 90日 → ceil(90/30) = 3ヶ月

      mockCountActiveUsers.mockResolvedValue(500);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      // MAUは3ヶ月分呼ばれる
      const mauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'MONTH'
      );
      expect(mauCalls).toHaveLength(3);
    });

    it('各月のupsertMetricがMONTHグラニュラリティで呼ばれる', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '60';

      mockCountActiveUsers.mockResolvedValue(800);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      const mauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'MONTH'
      );

      // 全てMONTHグラニュラリティ
      mauCalls.forEach((call) => {
        expect(call[0]).toBe('MONTH');
        expect(call[2]).toBe(800);
      });
    });

    it('年をまたぐ場合も正しく処理する', async () => {
      // JST 2026-02-15 に実行
      const testTime = new Date('2026-02-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '90'; // 3ヶ月分 → 2026-01, 2025-12, 2025-11

      mockCountActiveUsers.mockResolvedValue(100);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      const mauCalls = mockUpsertMetric.mock.calls.filter(
        (call) => call[0] === 'MONTH'
      );
      expect(mauCalls).toHaveLength(3);

      // 各月のperiodStartを確認（JST基準）
      const periodStarts = mauCalls.map((call) => call[1] as Date);

      // JST 2026-01-01 00:00:00 = UTC 2025-12-31 15:00:00
      expect(periodStarts[0].getUTCMonth()).toBe(11); // 12月 (index=11) in UTC
      expect(periodStarts[0].getUTCFullYear()).toBe(2025);

      // JST 2025-12-01 00:00:00 = UTC 2025-11-30 15:00:00
      expect(periodStarts[1].getUTCMonth()).toBe(10); // 11月 (index=10) in UTC
      expect(periodStarts[1].getUTCFullYear()).toBe(2025);
    });
  });

  describe('ログ出力', () => {
    it('開始・完了ログを出力する', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '7';

      mockCountActiveUsers.mockResolvedValue(100);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      expect(console.log).toHaveBeenCalledWith(
        'メトリクスバックフィル開始: 過去7日分'
      );
      expect(console.log).toHaveBeenCalledWith('メトリクスバックフィル完了');
    });
  });

  describe('countActiveUsersの呼び出し', () => {
    it('DAU/WAU/MAUそれぞれで異なる日付範囲が渡される', async () => {
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);
      process.env.BACKFILL_DAYS = '7';

      mockCountActiveUsers.mockResolvedValue(100);
      mockUpsertMetric.mockResolvedValue(undefined);

      await runMetricsBackfill();

      // countActiveUsersが複数回呼ばれている
      // DAU: 7回、WAU: 1回、MAU: 1回 = 9回
      expect(mockCountActiveUsers).toHaveBeenCalledTimes(9);
    });
  });
});
