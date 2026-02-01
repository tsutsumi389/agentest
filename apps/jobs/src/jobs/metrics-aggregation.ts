/**
 * メトリクス集計ジョブ
 * DAU/WAU/MAUを集計してテーブルに保存
 * 毎日 1:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';

/**
 * メトリクス集計ジョブのエントリーポイント
 */
export async function runMetricsAggregation(): Promise<void> {
  const now = new Date();

  console.log(`メトリクス集計開始: ${now.toISOString()}`);

  // 前日のDAU集計
  await aggregateDAU(now);

  // 週初（月曜）の場合、前週のWAU集計
  if (now.getDay() === 1) {
    await aggregateWAU(now);
  }

  // 月初の場合、前月のMAU集計
  if (now.getDate() === 1) {
    await aggregateMAU(now);
  }

  console.log('メトリクス集計完了');
}

/**
 * DAU（日次アクティブユーザー）集計
 */
async function aggregateDAU(now: Date): Promise<void> {
  // 前日の開始・終了を計算
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date(yesterday);
  today.setDate(today.getDate() + 1);

  // 前日にアクティブだったユニークユーザー数をカウント
  const count = await prisma.user.count({
    where: {
      deletedAt: null,
      sessions: {
        some: {
          lastActiveAt: { gte: yesterday, lt: today },
          revokedAt: null,
        },
      },
    },
  });

  // upsertで保存（再実行時も安全）
  await prisma.activeUserMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity: 'DAY',
        periodStart: yesterday,
      },
    },
    create: { granularity: 'DAY', periodStart: yesterday, userCount: count },
    update: { userCount: count },
  });

  console.log(`DAU ${yesterday.toISOString().split('T')[0]}: ${count}`);
}

/**
 * WAU（週次アクティブユーザー）集計
 */
async function aggregateWAU(now: Date): Promise<void> {
  // 前週の月曜日を計算
  const lastMonday = new Date(now);
  lastMonday.setDate(lastMonday.getDate() - 7);
  lastMonday.setHours(0, 0, 0, 0);

  const thisMonday = new Date(lastMonday);
  thisMonday.setDate(thisMonday.getDate() + 7);

  // 前週にアクティブだったユニークユーザー数をカウント
  const count = await prisma.user.count({
    where: {
      deletedAt: null,
      sessions: {
        some: {
          lastActiveAt: { gte: lastMonday, lt: thisMonday },
          revokedAt: null,
        },
      },
    },
  });

  await prisma.activeUserMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity: 'WEEK',
        periodStart: lastMonday,
      },
    },
    create: { granularity: 'WEEK', periodStart: lastMonday, userCount: count },
    update: { userCount: count },
  });

  console.log(`WAU ${lastMonday.toISOString().split('T')[0]}: ${count}`);
}

/**
 * MAU（月次アクティブユーザー）集計
 */
async function aggregateMAU(now: Date): Promise<void> {
  // 前月の1日を計算
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 前月にアクティブだったユニークユーザー数をカウント
  const count = await prisma.user.count({
    where: {
      deletedAt: null,
      sessions: {
        some: {
          lastActiveAt: { gte: lastMonthStart, lt: thisMonthStart },
          revokedAt: null,
        },
      },
    },
  });

  await prisma.activeUserMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity: 'MONTH',
        periodStart: lastMonthStart,
      },
    },
    create: {
      granularity: 'MONTH',
      periodStart: lastMonthStart,
      userCount: count,
    },
    update: { userCount: count },
  });

  console.log(`MAU ${lastMonthStart.toISOString().split('T')[0]}: ${count}`);
}
