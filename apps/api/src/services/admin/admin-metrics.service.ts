import { prisma } from '@agentest/db';
import type {
  ActiveUserMetricsResponse,
  ActiveUserMetricDataPoint,
  ActiveUserMetricSummary,
  MetricGranularity,
  PlanDistributionResponse,
  PlanDistributionDataPoint,
  PlanDistributionCurrent,
  PlanDistributionView,
} from '@agentest/shared';
import type { ActiveUserMetricsQuery, PlanDistributionQuery } from '@agentest/shared';
import type { MetricGranularity as PrismaGranularity } from '@agentest/db';
import {
  getAdminMetricsCache,
  setAdminMetricsCache,
} from '../../lib/redis-store.js';

// キャッシュTTL（秒）
const CACHE_TTL_PAST_DATA = 300; // 5分（過去データ用）
const CACHE_TTL_WITH_TODAY = 60; // 1分（当日データ込み）

// デフォルト期間（日数）
const DEFAULT_DAYS = 30;

/**
 * API粒度からPrisma粒度への変換
 */
function toPrismaGranularity(granularity: MetricGranularity): PrismaGranularity {
  const map: Record<MetricGranularity, PrismaGranularity> = {
    day: 'DAY',
    week: 'WEEK',
    month: 'MONTH',
  };
  return map[granularity];
}

/**
 * 日付をYYYY-MM-DD形式の文字列に変換
 */
function formatDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * 期間開始日を計算（粒度に応じて調整）
 */
function calculatePeriodStart(
  date: Date,
  granularity: MetricGranularity
): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);

  switch (granularity) {
    case 'week': {
      // 月曜日起点に調整
      // getDay(): 0=日曜, 1=月曜, 2=火曜, ..., 6=土曜
      // 日曜(0)の場合は6日前の月曜、それ以外は (曜日-1) 日前の月曜
      const dayOfWeek = result.getDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      result.setDate(result.getDate() - daysToSubtract);
      break;
    }
    case 'month':
      // 月初に調整
      result.setDate(1);
      break;
    // 'day'の場合はそのまま
  }

  return result;
}

/**
 * 前期間の開始日を計算
 */
function calculatePreviousPeriodStart(
  start: Date,
  end: Date,
  granularity: MetricGranularity
): { prevStart: Date; prevEnd: Date } {
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // 開始日の前日
  prevEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(prevEnd.getTime() - duration);
  prevStart.setHours(0, 0, 0, 0);

  // 粒度に応じて調整
  return {
    prevStart: calculatePeriodStart(prevStart, granularity),
    prevEnd,
  };
}

/**
 * 管理者メトリクスサービス
 */
export class AdminMetricsService {
  /**
   * アクティブユーザーメトリクスを取得
   */
  async getActiveUserMetrics(
    query: ActiveUserMetricsQuery
  ): Promise<ActiveUserMetricsResponse> {
    const granularity = query.granularity || 'day';
    // タイムゾーンはレスポンスに含めて返却。
    // 日付計算はUTCで行い、フロントエンドでタイムゾーン変換を行う想定。
    // サーバー側でのタイムゾーン考慮が必要な場合は date-fns-tz 等の導入を検討。
    const timezone = query.timezone || 'Asia/Tokyo';
    const now = new Date();

    // 開始日・終了日の計算
    const endDate = query.endDate ? new Date(query.endDate) : now;
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);

    // 粒度に応じた期間開始日に調整
    const adjustedStartDate = calculatePeriodStart(startDate, granularity);

    // キャッシュキー用パラメータ
    const cacheParams = {
      granularity,
      startDate: formatDateString(adjustedStartDate),
      endDate: formatDateString(endDate),
      timezone,
    };

    // 当日データを含むかどうか判定
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const includesCurrentPeriod = endDate >= today;

    // キャッシュをチェック
    const cached = await getAdminMetricsCache<ActiveUserMetricsResponse>(cacheParams);
    if (cached) {
      return cached;
    }

    // データを取得
    const data = await this.fetchMetricsData(
      adjustedStartDate,
      endDate,
      granularity,
      includesCurrentPeriod
    );

    // サマリーを計算
    const summary = await this.calculateSummary(
      data,
      adjustedStartDate,
      endDate,
      granularity
    );

    const response: ActiveUserMetricsResponse = {
      granularity,
      startDate: adjustedStartDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone,
      data,
      summary,
      fetchedAt: new Date().toISOString(),
    };

    // キャッシュに保存（当日データ込みの場合は短いTTL）
    const ttl = includesCurrentPeriod ? CACHE_TTL_WITH_TODAY : CACHE_TTL_PAST_DATA;
    await setAdminMetricsCache(cacheParams, response, ttl);

    return response;
  }

  /**
   * メトリクスデータを取得
   */
  private async fetchMetricsData(
    startDate: Date,
    endDate: Date,
    granularity: MetricGranularity,
    includesCurrentPeriod: boolean
  ): Promise<ActiveUserMetricDataPoint[]> {
    const prismaGranularity = toPrismaGranularity(granularity);

    // 集計済みデータを取得
    const metrics = await prisma.activeUserMetric.findMany({
      where: {
        granularity: prismaGranularity,
        periodStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { periodStart: 'asc' },
    });

    // データポイントに変換
    const data: ActiveUserMetricDataPoint[] = metrics.map((m) => ({
      date: formatDateString(m.periodStart),
      count: m.userCount,
    }));

    // 当日データを含む場合はリアルタイムで取得
    if (includesCurrentPeriod) {
      const currentPeriodData = await this.fetchCurrentPeriodData(granularity);
      if (currentPeriodData) {
        // 既存の当日データがあれば上書き、なければ追加
        const existingIndex = data.findIndex(
          (d) => d.date === currentPeriodData.date
        );
        if (existingIndex >= 0) {
          data[existingIndex] = currentPeriodData;
        } else {
          data.push(currentPeriodData);
        }
      }
    }

    return data;
  }

  /**
   * 当期間のリアルタイムデータを取得
   */
  private async fetchCurrentPeriodData(
    granularity: MetricGranularity
  ): Promise<ActiveUserMetricDataPoint | null> {
    const now = new Date();
    const periodStart = calculatePeriodStart(now, granularity);

    // 期間終了日を計算（periodStartを基準に粒度分の期間を加算）
    // periodEndは排他的境界として使用（lt: periodEnd）
    const periodEnd = new Date(periodStart);
    switch (granularity) {
      case 'week':
        // 週次: 7日後
        periodEnd.setDate(periodStart.getDate() + 7);
        break;
      case 'month':
        // 月次: 翌月1日
        periodEnd.setMonth(periodStart.getMonth() + 1);
        break;
      default:
        // 日次: 翌日
        periodEnd.setDate(periodStart.getDate() + 1);
    }

    const count = await prisma.user.count({
      where: {
        deletedAt: null,
        sessions: {
          some: {
            lastActiveAt: { gte: periodStart, lt: periodEnd },
            revokedAt: null,
          },
        },
      },
    });

    return {
      date: formatDateString(periodStart),
      count,
    };
  }

  /**
   * サマリーを計算
   */
  private async calculateSummary(
    data: ActiveUserMetricDataPoint[],
    startDate: Date,
    endDate: Date,
    granularity: MetricGranularity
  ): Promise<ActiveUserMetricSummary> {
    if (data.length === 0) {
      return {
        average: 0,
        max: 0,
        min: 0,
        changeRate: null,
      };
    }

    const counts = data.map((d) => d.count);
    const sum = counts.reduce((acc, val) => acc + val, 0);
    const average = Math.round(sum / counts.length);
    const max = Math.max(...counts);
    const min = Math.min(...counts);

    // 前期間比を計算
    const changeRate = await this.calculateChangeRate(
      average,
      startDate,
      endDate,
      granularity
    );

    return {
      average,
      max,
      min,
      changeRate,
    };
  }

  /**
   * 前期間比を計算
   */
  private async calculateChangeRate(
    currentAverage: number,
    startDate: Date,
    endDate: Date,
    granularity: MetricGranularity
  ): Promise<number | null> {
    const { prevStart, prevEnd } = calculatePreviousPeriodStart(
      startDate,
      endDate,
      granularity
    );

    const prismaGranularity = toPrismaGranularity(granularity);

    // 前期間の集計済みデータを取得
    const prevMetrics = await prisma.activeUserMetric.findMany({
      where: {
        granularity: prismaGranularity,
        periodStart: {
          gte: prevStart,
          lte: prevEnd,
        },
      },
    });

    if (prevMetrics.length === 0) {
      return null;
    }

    const prevSum = prevMetrics.reduce((acc, m) => acc + m.userCount, 0);
    const prevAverage = prevSum / prevMetrics.length;

    if (prevAverage === 0) {
      return null;
    }

    // 変化率を計算（小数点1桁まで）
    const changeRate = ((currentAverage - prevAverage) / prevAverage) * 100;
    return Math.round(changeRate * 10) / 10;
  }

  // ============================================
  // プラン分布メトリクス
  // ============================================

  /**
   * プラン分布メトリクスを取得
   */
  async getPlanDistribution(
    query: PlanDistributionQuery
  ): Promise<PlanDistributionResponse> {
    const granularity = query.granularity || 'day';
    const timezone = query.timezone || 'Asia/Tokyo';
    const view = (query.view || 'combined') as PlanDistributionView;
    const includeMembers = query.includeMembers !== false;
    const now = new Date();

    // 開始日・終了日の計算
    const endDate = query.endDate ? new Date(query.endDate) : now;
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - DEFAULT_DAYS * 24 * 60 * 60 * 1000);

    // 粒度に応じた期間開始日に調整
    const adjustedStartDate = calculatePeriodStart(startDate, granularity);

    // キャッシュキー用パラメータ
    const cacheParams = {
      type: 'plan-distribution',
      granularity,
      startDate: formatDateString(adjustedStartDate),
      endDate: formatDateString(endDate),
      timezone,
      view,
      includeMembers,
    };

    // 当日データを含むかどうか判定
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const includesCurrentPeriod = endDate >= today;

    // キャッシュをチェック
    const cached = await getAdminMetricsCache<PlanDistributionResponse>(cacheParams);
    if (cached) {
      return cached;
    }

    // 時系列データを取得
    const data = await this.fetchPlanDistributionData(
      adjustedStartDate,
      endDate,
      granularity,
      view,
      includeMembers
    );

    // 現在のスナップショットを取得
    const current = await this.fetchCurrentPlanDistribution(view, includeMembers);

    const response: PlanDistributionResponse = {
      granularity,
      startDate: adjustedStartDate.toISOString(),
      endDate: endDate.toISOString(),
      timezone,
      view,
      data,
      current,
      fetchedAt: new Date().toISOString(),
    };

    // キャッシュに保存（当日データ込みの場合は短いTTL）
    const ttl = includesCurrentPeriod ? CACHE_TTL_WITH_TODAY : CACHE_TTL_PAST_DATA;
    await setAdminMetricsCache(cacheParams, response, ttl);

    return response;
  }

  /**
   * プラン分布の時系列データを取得
   */
  private async fetchPlanDistributionData(
    startDate: Date,
    endDate: Date,
    granularity: MetricGranularity,
    view: PlanDistributionView,
    includeMembers: boolean
  ): Promise<PlanDistributionDataPoint[]> {
    const prismaGranularity = toPrismaGranularity(granularity);

    // 集計済みデータを取得
    const metrics = await prisma.planDistributionMetric.findMany({
      where: {
        granularity: prismaGranularity,
        periodStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { periodStart: 'asc' },
    });

    // データポイントに変換
    return metrics.map((m) => {
      const point: PlanDistributionDataPoint = {
        date: formatDateString(m.periodStart),
      };

      if (view === 'users' || view === 'combined') {
        point.users = {
          free: m.freeUserCount,
          pro: m.proUserCount,
        };
      }

      if (view === 'organizations' || view === 'combined') {
        point.organizations = {
          team: m.teamOrgCount,
          enterprise: m.enterpriseOrgCount,
          teamMembers: includeMembers ? m.teamMemberCount : 0,
          enterpriseMembers: includeMembers ? m.enterpriseMemberCount : 0,
        };
      }

      return point;
    });
  }

  /**
   * 現在時点のプラン分布スナップショットを取得
   */
  private async fetchCurrentPlanDistribution(
    view: PlanDistributionView,
    includeMembers: boolean
  ): Promise<PlanDistributionCurrent> {
    const current: PlanDistributionCurrent = {};

    // 30日前の日時（アクティブ判定用）
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (view === 'users' || view === 'combined') {
      current.users = await this.fetchUserPlanDistribution(thirtyDaysAgo);
    }

    if (view === 'organizations' || view === 'combined') {
      current.organizations = await this.fetchOrganizationPlanDistribution(
        thirtyDaysAgo,
        includeMembers
      );
    }

    if (view === 'combined' && current.users && current.organizations) {
      current.combined = this.calculateCombinedDistribution(
        current.users,
        current.organizations
      );
    }

    return current;
  }

  /**
   * ユーザープラン分布を取得
   */
  private async fetchUserPlanDistribution(
    activeThreshold: Date
  ): Promise<PlanDistributionCurrent['users']> {
    // サブスクリプションごとの集計
    const [freeUsers, proUsers] = await Promise.all([
      // FREE: サブスクリプションがない、またはFREEプラン
      prisma.user.count({
        where: {
          deletedAt: null,
          OR: [
            { subscription: null },
            { subscription: { plan: 'FREE', status: 'ACTIVE' } },
          ],
        },
      }),
      // PRO: PROプランのサブスクリプション
      prisma.user.count({
        where: {
          deletedAt: null,
          subscription: { plan: 'PRO', status: 'ACTIVE' },
        },
      }),
    ]);

    // アクティブユーザー数を取得
    const [freeActiveUsers, proActiveUsers] = await Promise.all([
      prisma.user.count({
        where: {
          deletedAt: null,
          OR: [
            { subscription: null },
            { subscription: { plan: 'FREE', status: 'ACTIVE' } },
          ],
          sessions: {
            some: {
              lastActiveAt: { gte: activeThreshold },
              revokedAt: null,
            },
          },
        },
      }),
      prisma.user.count({
        where: {
          deletedAt: null,
          subscription: { plan: 'PRO', status: 'ACTIVE' },
          sessions: {
            some: {
              lastActiveAt: { gte: activeThreshold },
              revokedAt: null,
            },
          },
        },
      }),
    ]);

    const total = freeUsers + proUsers;

    return {
      total,
      byPlan: {
        free: {
          count: freeUsers,
          percentage: total > 0 ? Math.round((freeUsers / total) * 1000) / 10 : 0,
          activeCount: freeActiveUsers,
        },
        pro: {
          count: proUsers,
          percentage: total > 0 ? Math.round((proUsers / total) * 1000) / 10 : 0,
          activeCount: proActiveUsers,
        },
      },
    };
  }

  /**
   * 組織プラン分布を取得
   */
  private async fetchOrganizationPlanDistribution(
    activeThreshold: Date,
    includeMembers: boolean
  ): Promise<PlanDistributionCurrent['organizations']> {
    // 組織数を取得
    const [teamOrgs, enterpriseOrgs] = await Promise.all([
      prisma.organization.count({
        where: {
          deletedAt: null,
          OR: [
            { subscription: null },
            { subscription: { plan: 'TEAM', status: 'ACTIVE' } },
          ],
        },
      }),
      prisma.organization.count({
        where: {
          deletedAt: null,
          subscription: { plan: 'ENTERPRISE', status: 'ACTIVE' },
        },
      }),
    ]);

    // メンバー数を取得
    let teamMembers = 0;
    let enterpriseMembers = 0;

    if (includeMembers) {
      const memberCounts = await Promise.all([
        prisma.organizationMember.count({
          where: {
            organization: {
              deletedAt: null,
              OR: [
                { subscription: null },
                { subscription: { plan: 'TEAM', status: 'ACTIVE' } },
              ],
            },
          },
        }),
        prisma.organizationMember.count({
          where: {
            organization: {
              deletedAt: null,
              subscription: { plan: 'ENTERPRISE', status: 'ACTIVE' },
            },
          },
        }),
      ]);
      teamMembers = memberCounts[0];
      enterpriseMembers = memberCounts[1];
    }

    // アクティブ組織数を取得（30日以内にメンバーがアクティブ）
    const [teamActiveOrgs, enterpriseActiveOrgs] = await Promise.all([
      prisma.organization.count({
        where: {
          deletedAt: null,
          OR: [
            { subscription: null },
            { subscription: { plan: 'TEAM', status: 'ACTIVE' } },
          ],
          members: {
            some: {
              user: {
                sessions: {
                  some: {
                    lastActiveAt: { gte: activeThreshold },
                    revokedAt: null,
                  },
                },
              },
            },
          },
        },
      }),
      prisma.organization.count({
        where: {
          deletedAt: null,
          subscription: { plan: 'ENTERPRISE', status: 'ACTIVE' },
          members: {
            some: {
              user: {
                sessions: {
                  some: {
                    lastActiveAt: { gte: activeThreshold },
                    revokedAt: null,
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const total = teamOrgs + enterpriseOrgs;
    const totalMembers = teamMembers + enterpriseMembers;

    return {
      total,
      totalMembers,
      byPlan: {
        team: {
          count: teamOrgs,
          percentage: total > 0 ? Math.round((teamOrgs / total) * 1000) / 10 : 0,
          members: teamMembers,
          activeCount: teamActiveOrgs,
        },
        enterprise: {
          count: enterpriseOrgs,
          percentage: total > 0 ? Math.round((enterpriseOrgs / total) * 1000) / 10 : 0,
          members: enterpriseMembers,
          activeCount: enterpriseActiveOrgs,
        },
      },
    };
  }

  /**
   * 統合プラン分布を計算
   */
  private calculateCombinedDistribution(
    users: NonNullable<PlanDistributionCurrent['users']>,
    organizations: NonNullable<PlanDistributionCurrent['organizations']>
  ): PlanDistributionCurrent['combined'] {
    // 統合計算: ユーザー数 + 組織メンバー数
    const freeCount = users.byPlan.free.count;
    const proCount = users.byPlan.pro.count;
    const teamCount = organizations.byPlan.team.members || 0;
    const enterpriseCount = organizations.byPlan.enterprise.members || 0;

    const total = freeCount + proCount + teamCount + enterpriseCount;

    return {
      total,
      byPlan: {
        free: {
          count: freeCount,
          percentage: total > 0 ? Math.round((freeCount / total) * 1000) / 10 : 0,
        },
        pro: {
          count: proCount,
          percentage: total > 0 ? Math.round((proCount / total) * 1000) / 10 : 0,
        },
        team: {
          count: teamCount,
          percentage: total > 0 ? Math.round((teamCount / total) * 1000) / 10 : 0,
        },
        enterprise: {
          count: enterpriseCount,
          percentage: total > 0 ? Math.round((enterpriseCount / total) * 1000) / 10 : 0,
        },
      },
    };
  }
}
