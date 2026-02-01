/**
 * メトリクス集計ユーティリティ
 * DAU/WAU/MAU集計の共通ロジックを提供
 */
import { prisma } from './prisma.js';
import type { MetricGranularity } from '@agentest/db';

/**
 * 指定期間内のアクティブユーザー数をカウント
 * @param startDate 期間開始日時（この時刻以降）
 * @param endDate 期間終了日時（この時刻より前）
 * @returns ユニークユーザー数
 */
export async function countActiveUsers(
  startDate: Date,
  endDate: Date
): Promise<number> {
  return prisma.user.count({
    where: {
      deletedAt: null,
      sessions: {
        some: {
          lastActiveAt: { gte: startDate, lt: endDate },
          revokedAt: null,
        },
      },
    },
  });
}

/**
 * メトリクスをupsert（存在すれば更新、なければ作成）
 * @param granularity 粒度（DAY/WEEK/MONTH）
 * @param periodStart 期間開始日
 * @param userCount ユーザー数
 */
export async function upsertMetric(
  granularity: MetricGranularity,
  periodStart: Date,
  userCount: number
): Promise<void> {
  await prisma.activeUserMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity,
        periodStart,
      },
    },
    create: { granularity, periodStart, userCount },
    update: { userCount },
  });
}
