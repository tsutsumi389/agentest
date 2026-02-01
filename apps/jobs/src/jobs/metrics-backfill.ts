/**
 * メトリクスバックフィルジョブ
 * 過去のセッションデータからDAU/WAU/MAUを集計してテーブルに投入
 * 初回デプロイ時または手動実行用
 *
 * 環境変数:
 * - BACKFILL_DAYS: 遡る日数（デフォルト: 90日）
 */
import { prisma } from '../lib/prisma.js';

// デフォルトのバックフィル期間（日数）
const DEFAULT_BACKFILL_DAYS = 90;

/**
 * メトリクスバックフィルジョブのエントリーポイント
 */
export async function runMetricsBackfill(): Promise<void> {
  const backfillDays = parseInt(
    process.env.BACKFILL_DAYS || String(DEFAULT_BACKFILL_DAYS),
    10
  );

  console.log(`メトリクスバックフィル開始: 過去${backfillDays}日分`);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // DAUをバックフィル
  await backfillDAU(now, backfillDays);

  // WAUをバックフィル
  await backfillWAU(now, backfillDays);

  // MAUをバックフィル
  await backfillMAU(now, backfillDays);

  console.log('メトリクスバックフィル完了');
}

/**
 * DAU（日次アクティブユーザー）のバックフィル
 */
async function backfillDAU(now: Date, days: number): Promise<void> {
  console.log(`DAUバックフィル開始: ${days}日分`);

  let totalUpserted = 0;

  for (let i = 1; i <= days; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - i);

    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // 対象日にアクティブだったユニークユーザー数をカウント
    const count = await prisma.user.count({
      where: {
        deletedAt: null,
        sessions: {
          some: {
            lastActiveAt: { gte: targetDate, lt: nextDate },
            revokedAt: null,
          },
        },
      },
    });

    // upsertで保存
    await prisma.activeUserMetric.upsert({
      where: {
        granularity_periodStart: {
          granularity: 'DAY',
          periodStart: targetDate,
        },
      },
      create: { granularity: 'DAY', periodStart: targetDate, userCount: count },
      update: { userCount: count },
    });

    totalUpserted++;
    if (i % 30 === 0) {
      console.log(`DAU進捗: ${i}/${days}日 (${count} users)`);
    }
  }

  console.log(`DAUバックフィル完了: ${totalUpserted}件`);
}

/**
 * WAU（週次アクティブユーザー）のバックフィル
 */
async function backfillWAU(now: Date, days: number): Promise<void> {
  // 週数を計算
  const weeks = Math.ceil(days / 7);
  console.log(`WAUバックフィル開始: ${weeks}週分`);

  let totalUpserted = 0;

  // 直近の月曜日を取得
  const lastMonday = getLastMonday(now);

  for (let i = 1; i <= weeks; i++) {
    const weekStart = new Date(lastMonday);
    weekStart.setDate(weekStart.getDate() - i * 7);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // 対象週にアクティブだったユニークユーザー数をカウント
    const count = await prisma.user.count({
      where: {
        deletedAt: null,
        sessions: {
          some: {
            lastActiveAt: { gte: weekStart, lt: weekEnd },
            revokedAt: null,
          },
        },
      },
    });

    await prisma.activeUserMetric.upsert({
      where: {
        granularity_periodStart: {
          granularity: 'WEEK',
          periodStart: weekStart,
        },
      },
      create: { granularity: 'WEEK', periodStart: weekStart, userCount: count },
      update: { userCount: count },
    });

    totalUpserted++;
  }

  console.log(`WAUバックフィル完了: ${totalUpserted}件`);
}

/**
 * MAU（月次アクティブユーザー）のバックフィル
 */
async function backfillMAU(now: Date, days: number): Promise<void> {
  // 月数を計算
  const months = Math.ceil(days / 30);
  console.log(`MAUバックフィル開始: ${months}ヶ月分`);

  let totalUpserted = 0;

  for (let i = 1; i <= months; i++) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    // 対象月にアクティブだったユニークユーザー数をカウント
    const count = await prisma.user.count({
      where: {
        deletedAt: null,
        sessions: {
          some: {
            lastActiveAt: { gte: monthStart, lt: monthEnd },
            revokedAt: null,
          },
        },
      },
    });

    await prisma.activeUserMetric.upsert({
      where: {
        granularity_periodStart: {
          granularity: 'MONTH',
          periodStart: monthStart,
        },
      },
      create: {
        granularity: 'MONTH',
        periodStart: monthStart,
        userCount: count,
      },
      update: { userCount: count },
    });

    totalUpserted++;
  }

  console.log(`MAUバックフィル完了: ${totalUpserted}件`);
}

/**
 * 直近の月曜日を取得
 */
function getLastMonday(date: Date): Date {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  // 日曜(0)の場合は6日前、それ以外は (曜日-1) 日前
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  result.setDate(result.getDate() - daysToSubtract);
  return result;
}
