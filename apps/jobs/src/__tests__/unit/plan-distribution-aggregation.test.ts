/**
 * plan-distribution-aggregation ユニットテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted() でモックオブジェクトを事前定義
const {
  mockPrisma,
  mockLogger,
  mockGetJSTYesterdayStart,
  mockGetJSTDayOfWeek,
  mockGetJSTDayOfMonth,
  mockGetJSTLastMonday,
  mockGetJSTLastMonthStart,
  mockFormatDateStringJST,
} = vi.hoisted(() => {
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
    mockPrisma: {
      user: {
        count: vi.fn(),
      },
      organization: {
        count: vi.fn(),
      },
      organizationMember: {
        count: vi.fn(),
      },
      planDistributionMetric: {
        upsert: vi.fn(),
      },
    },
    mockLogger,
    mockGetJSTYesterdayStart: vi.fn(),
    mockGetJSTDayOfWeek: vi.fn(),
    mockGetJSTDayOfMonth: vi.fn(),
    mockGetJSTLastMonday: vi.fn(),
    mockGetJSTLastMonthStart: vi.fn(),
    mockFormatDateStringJST: vi.fn(),
  };
});

vi.mock('../../lib/prisma.js', () => ({
  prisma: mockPrisma,
}));

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

vi.mock('../../lib/date-utils.js', () => ({
  getJSTYesterdayStart: mockGetJSTYesterdayStart,
  getJSTDayOfWeek: mockGetJSTDayOfWeek,
  getJSTDayOfMonth: mockGetJSTDayOfMonth,
  getJSTLastMonday: mockGetJSTLastMonday,
  getJSTLastMonthStart: mockGetJSTLastMonthStart,
  formatDateStringJST: mockFormatDateStringJST,
}));

// モック設定後にインポート
import { runPlanDistributionAggregation } from '../../jobs/plan-distribution-aggregation.js';

describe('runPlanDistributionAggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Prismaのcountモックにデフォルト値を設定するヘルパー
   * user.count: freeUsers=100, proUsers=50
   * organization.count: teamOrgs=20, enterpriseOrgs=5
   * organizationMember.count: teamMembers=80, enterpriseMembers=30
   */
  function setupDefaultCounts() {
    // user.count は2回呼ばれる（FREE, PRO）
    mockPrisma.user.count
      .mockResolvedValueOnce(100) // freeUsers
      .mockResolvedValueOnce(50); // proUsers
    // organization.count は2回呼ばれる（TEAM, ENTERPRISE）
    mockPrisma.organization.count
      .mockResolvedValueOnce(20) // teamOrgs
      .mockResolvedValueOnce(5); // enterpriseOrgs
    // organizationMember.count は2回呼ばれる（TEAM, ENTERPRISE）
    mockPrisma.organizationMember.count
      .mockResolvedValueOnce(80) // teamMembers
      .mockResolvedValueOnce(30); // enterpriseMembers

    mockPrisma.planDistributionMetric.upsert.mockResolvedValue(undefined);
  }

  /**
   * 日付モックをセットアップするヘルパー
   * dayOfWeek: 曜日（0=日, 1=月, ..., 6=土）
   * dayOfMonth: 月の日（1-31）
   */
  function setupDateMocks(options: {
    dayOfWeek: number;
    dayOfMonth: number;
    yesterday?: Date;
    lastMonday?: Date;
    lastMonthStart?: Date;
  }) {
    mockGetJSTDayOfWeek.mockReturnValue(options.dayOfWeek);
    mockGetJSTDayOfMonth.mockReturnValue(options.dayOfMonth);
    mockGetJSTYesterdayStart.mockReturnValue(
      options.yesterday ?? new Date('2026-01-14T15:00:00.000Z')
    );
    mockGetJSTLastMonday.mockReturnValue(
      options.lastMonday ?? new Date('2026-01-12T15:00:00.000Z')
    );
    mockGetJSTLastMonthStart.mockReturnValue(
      options.lastMonthStart ?? new Date('2025-12-31T15:00:00.000Z')
    );
    mockFormatDateStringJST.mockImplementation((date: Date) => {
      // JST基準で日付文字列を返す簡易実装
      const jstTime = date.getTime() + 9 * 60 * 60 * 1000;
      const jstDate = new Date(jstTime);
      const year = jstDate.getUTCFullYear();
      const month = String(jstDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(jstDate.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    });
  }

  describe('DAY集計', () => {
    it('前日分の集計が正しく行われる', async () => {
      // 2026-01-15 10:00:00 JST（木曜日、15日）
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      const expectedYesterday = new Date('2026-01-14T15:00:00.000Z');

      setupDateMocks({
        dayOfWeek: 4, // 木曜日
        dayOfMonth: 15,
        yesterday: expectedYesterday,
      });
      setupDefaultCounts();

      await runPlanDistributionAggregation();

      // getJSTYesterdayStartが呼ばれることを確認
      expect(mockGetJSTYesterdayStart).toHaveBeenCalledWith(testTime);

      // planDistributionMetric.upsertがDAY粒度で呼ばれることを確認
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledWith({
        where: {
          granularity_periodStart: {
            granularity: 'DAY',
            periodStart: expectedYesterday,
          },
        },
        update: {
          freeUserCount: 100,
          proUserCount: 50,
          teamOrgCount: 20,
          teamMemberCount: 80,
          enterpriseOrgCount: 5,
          enterpriseMemberCount: 30,
        },
        create: {
          granularity: 'DAY',
          periodStart: expectedYesterday,
          freeUserCount: 100,
          proUserCount: 50,
          teamOrgCount: 20,
          teamMemberCount: 80,
          enterpriseOrgCount: 5,
          enterpriseMemberCount: 30,
        },
      });
    });

    it('全プラン分布が正しく保存される', async () => {
      // 2026-01-15 10:00:00 JST（木曜日、15日）
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      setupDateMocks({
        dayOfWeek: 4, // 木曜日
        dayOfMonth: 15,
      });

      // カスタムカウント値を設定
      mockPrisma.user.count
        .mockResolvedValueOnce(200) // freeUsers
        .mockResolvedValueOnce(75); // proUsers
      mockPrisma.organization.count
        .mockResolvedValueOnce(30) // teamOrgs
        .mockResolvedValueOnce(10); // enterpriseOrgs
      mockPrisma.organizationMember.count
        .mockResolvedValueOnce(120) // teamMembers
        .mockResolvedValueOnce(50); // enterpriseMembers
      mockPrisma.planDistributionMetric.upsert.mockResolvedValue(undefined);

      await runPlanDistributionAggregation();

      // user.countがFREEとPROの条件で呼ばれることを確認
      expect(mockPrisma.user.count).toHaveBeenCalledTimes(2);
      // FREE: サブスクリプションなし or FREEプラン
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { subscription: null },
            { subscription: { plan: 'FREE', status: 'ACTIVE' } },
          ],
        },
      });
      // PRO: PROプランのサブスクリプション
      expect(mockPrisma.user.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          subscription: { plan: 'PRO', status: 'ACTIVE' },
        },
      });

      // organization.countがTEAMとENTERPRISEの条件で呼ばれることを確認
      expect(mockPrisma.organization.count).toHaveBeenCalledTimes(2);
      expect(mockPrisma.organization.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          OR: [
            { subscription: null },
            { subscription: { plan: 'TEAM', status: 'ACTIVE' } },
          ],
        },
      });
      expect(mockPrisma.organization.count).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          subscription: { plan: 'ENTERPRISE', status: 'ACTIVE' },
        },
      });

      // organizationMember.countがTEAMとENTERPRISEの条件で呼ばれることを確認
      expect(mockPrisma.organizationMember.count).toHaveBeenCalledTimes(2);
      expect(mockPrisma.organizationMember.count).toHaveBeenCalledWith({
        where: {
          organization: {
            deletedAt: null,
            OR: [
              { subscription: null },
              { subscription: { plan: 'TEAM', status: 'ACTIVE' } },
            ],
          },
        },
      });
      expect(mockPrisma.organizationMember.count).toHaveBeenCalledWith({
        where: {
          organization: {
            deletedAt: null,
            subscription: { plan: 'ENTERPRISE', status: 'ACTIVE' },
          },
        },
      });

      // upsertに正しい値が渡されることを確認
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            freeUserCount: 200,
            proUserCount: 75,
            teamOrgCount: 30,
            teamMemberCount: 120,
            enterpriseOrgCount: 10,
            enterpriseMemberCount: 50,
          },
          create: expect.objectContaining({
            freeUserCount: 200,
            proUserCount: 75,
            teamOrgCount: 30,
            teamMemberCount: 120,
            enterpriseOrgCount: 10,
            enterpriseMemberCount: 50,
          }),
        })
      );

      // DAY集計のログが出力されることを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          granularity: 'DAY',
          freeUsers: 200,
          proUsers: 75,
          teamOrgs: 30,
          teamMembers: 120,
          enterpriseOrgs: 10,
          enterpriseMembers: 50,
        }),
        'DAY集計完了'
      );
    });
  });

  describe('WEEK集計', () => {
    it('月曜日（dayOfWeek=1）の場合のみ実行される', async () => {
      // 2026-01-19 10:00:00 JST（月曜日、19日）
      const testTime = new Date('2026-01-19T01:00:00.000Z');
      vi.setSystemTime(testTime);

      const thisMonday = new Date('2026-01-18T15:00:00.000Z'); // JST 2026-01-19 00:00
      const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);

      setupDateMocks({
        dayOfWeek: 1, // 月曜日
        dayOfMonth: 19,
        lastMonday: thisMonday,
      });

      // DAY集計用（1回目）+ WEEK集計用（2回目）の合計2セット
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // DAY: freeUsers
        .mockResolvedValueOnce(50) // DAY: proUsers
        .mockResolvedValueOnce(100) // WEEK: freeUsers
        .mockResolvedValueOnce(50); // WEEK: proUsers
      mockPrisma.organization.count
        .mockResolvedValueOnce(20) // DAY: teamOrgs
        .mockResolvedValueOnce(5) // DAY: enterpriseOrgs
        .mockResolvedValueOnce(20) // WEEK: teamOrgs
        .mockResolvedValueOnce(5); // WEEK: enterpriseOrgs
      mockPrisma.organizationMember.count
        .mockResolvedValueOnce(80) // DAY: teamMembers
        .mockResolvedValueOnce(30) // DAY: enterpriseMembers
        .mockResolvedValueOnce(80) // WEEK: teamMembers
        .mockResolvedValueOnce(30); // WEEK: enterpriseMembers
      mockPrisma.planDistributionMetric.upsert.mockResolvedValue(undefined);

      await runPlanDistributionAggregation();

      // upsertが2回呼ばれる（DAY + WEEK）
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledTimes(2);

      // WEEK粒度のupsertが呼ばれることを確認
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            granularity_periodStart: {
              granularity: 'WEEK',
              periodStart: lastMonday,
            },
          },
        })
      );

      // WEEK集計完了のログが出力されることを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'WEEK' }),
        'WEEK集計完了'
      );
    });

    it('月曜日以外は実行されない', async () => {
      // 2026-01-15 10:00:00 JST（木曜日、15日）
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      setupDateMocks({
        dayOfWeek: 4, // 木曜日
        dayOfMonth: 15,
      });
      setupDefaultCounts();

      await runPlanDistributionAggregation();

      // upsertはDAYの1回のみ
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledTimes(1);

      // DAY粒度のみ呼ばれることを確認
      const granularities = mockPrisma.planDistributionMetric.upsert.mock.calls.map(
        (call: unknown[]) => (call[0] as { where: { granularity_periodStart: { granularity: string } } }).where.granularity_periodStart.granularity
      );
      expect(granularities).toContain('DAY');
      expect(granularities).not.toContain('WEEK');

      // WEEK集計のログは出力されない
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'WEEK' }),
        'WEEK集計完了'
      );
    });
  });

  describe('MONTH集計', () => {
    it('月初（dayOfMonth=1）の場合のみ実行される', async () => {
      // 2026-02-01 10:00:00 JST（日曜日、1日）
      const testTime = new Date('2026-02-01T01:00:00.000Z');
      vi.setSystemTime(testTime);

      const lastMonthStart = new Date('2025-12-31T15:00:00.000Z'); // JST 2026-01-01 00:00

      setupDateMocks({
        dayOfWeek: 0, // 日曜日
        dayOfMonth: 1, // 月初
        lastMonthStart,
      });

      // DAY集計用 + MONTH集計用の合計2セット
      mockPrisma.user.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50);
      mockPrisma.organization.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5);
      mockPrisma.organizationMember.count
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(30);
      mockPrisma.planDistributionMetric.upsert.mockResolvedValue(undefined);

      await runPlanDistributionAggregation();

      // upsertが2回呼ばれる（DAY + MONTH）
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledTimes(2);

      // MONTH粒度のupsertが呼ばれることを確認
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            granularity_periodStart: {
              granularity: 'MONTH',
              periodStart: lastMonthStart,
            },
          },
        })
      );

      // MONTH集計完了のログが出力されることを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'MONTH' }),
        'MONTH集計完了'
      );
    });

    it('月初以外は実行されない', async () => {
      // 2026-01-15 10:00:00 JST（木曜日、15日）
      const testTime = new Date('2026-01-15T01:00:00.000Z');
      vi.setSystemTime(testTime);

      setupDateMocks({
        dayOfWeek: 4, // 木曜日
        dayOfMonth: 15,
      });
      setupDefaultCounts();

      await runPlanDistributionAggregation();

      // upsertはDAYの1回のみ
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledTimes(1);

      // MONTH粒度は呼ばれない
      const granularities = mockPrisma.planDistributionMetric.upsert.mock.calls.map(
        (call: unknown[]) => (call[0] as { where: { granularity_periodStart: { granularity: string } } }).where.granularity_periodStart.granularity
      );
      expect(granularities).not.toContain('MONTH');

      // MONTH集計のログは出力されない
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'MONTH' }),
        'MONTH集計完了'
      );
    });
  });

  describe('複合条件', () => {
    it('月曜日かつ月初の場合、DAY+WEEK+MONTHすべて実行される', async () => {
      // 2026-06-01 10:00:00 JST（月曜日かつ月初）
      const testTime = new Date('2026-06-01T01:00:00.000Z');
      vi.setSystemTime(testTime);

      const yesterday = new Date('2026-05-31T15:00:00.000Z'); // JST 2026-06-01の前日
      const thisMonday = new Date('2026-05-31T15:00:00.000Z'); // JST 2026-06-01 00:00（月曜）
      const lastMonthStart = new Date('2026-04-30T15:00:00.000Z'); // JST 2026-05-01 00:00

      setupDateMocks({
        dayOfWeek: 1, // 月曜日
        dayOfMonth: 1, // 月初
        yesterday,
        lastMonday: thisMonday,
        lastMonthStart,
      });

      // DAY + WEEK + MONTH の合計3セット分のカウント
      mockPrisma.user.count
        .mockResolvedValueOnce(100) // DAY: freeUsers
        .mockResolvedValueOnce(50) // DAY: proUsers
        .mockResolvedValueOnce(100) // WEEK: freeUsers
        .mockResolvedValueOnce(50) // WEEK: proUsers
        .mockResolvedValueOnce(100) // MONTH: freeUsers
        .mockResolvedValueOnce(50); // MONTH: proUsers
      mockPrisma.organization.count
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(5);
      mockPrisma.organizationMember.count
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(30);
      mockPrisma.planDistributionMetric.upsert.mockResolvedValue(undefined);

      await runPlanDistributionAggregation();

      // upsertが3回呼ばれる（DAY + WEEK + MONTH）
      expect(mockPrisma.planDistributionMetric.upsert).toHaveBeenCalledTimes(3);

      // 全粒度のupsertが呼ばれることを確認
      const granularities = mockPrisma.planDistributionMetric.upsert.mock.calls.map(
        (call: unknown[]) => (call[0] as { where: { granularity_periodStart: { granularity: string } } }).where.granularity_periodStart.granularity
      );
      expect(granularities).toContain('DAY');
      expect(granularities).toContain('WEEK');
      expect(granularities).toContain('MONTH');

      // 全粒度の集計完了ログが出力されることを確認
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'DAY' }),
        'DAY集計完了'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'WEEK' }),
        'WEEK集計完了'
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ granularity: 'MONTH' }),
        'MONTH集計完了'
      );
    });
  });
});
