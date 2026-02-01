/**
 * メトリクスバックフィルジョブ
 * 過去のセッションデータからDAU/WAU/MAUを集計してテーブルに投入
 * 初回デプロイ時または手動実行用
 *
 * 環境変数:
 * - BACKFILL_DAYS: 遡る日数（デフォルト: 90日）
 */
import { countActiveUsers, upsertMetric } from '../lib/metrics-utils.js';
import {
  getJSTStartOfDay,
  getJSTLastMonday,
  getJSTMonthStartNMonthsAgo,
  formatDateStringJST,
} from '../lib/date-utils.js';

// デフォルトのバックフィル期間（日数）
const DEFAULT_BACKFILL_DAYS = 90;

// 1日のミリ秒
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
  const todayStart = getJSTStartOfDay(now);

  for (let i = 1; i <= days; i++) {
    const targetDate = new Date(todayStart.getTime() - i * ONE_DAY_MS);
    const nextDate = new Date(targetDate.getTime() + ONE_DAY_MS);

    const count = await countActiveUsers(targetDate, nextDate);
    await upsertMetric('DAY', targetDate, count);

    totalUpserted++;
    if (i % 30 === 0) {
      console.log(
        `DAU進捗: ${i}/${days}日 (${formatDateStringJST(targetDate)}: ${count} users)`
      );
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

  // 直近の月曜日を取得（JST基準）
  const lastMonday = getJSTLastMonday(now);

  for (let i = 1; i <= weeks; i++) {
    const weekStart = new Date(lastMonday.getTime() - i * 7 * ONE_DAY_MS);
    const weekEnd = new Date(weekStart.getTime() + 7 * ONE_DAY_MS);

    const count = await countActiveUsers(weekStart, weekEnd);
    await upsertMetric('WEEK', weekStart, count);

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
    // i ヶ月前と (i-1) ヶ月前の月初を取得
    const monthStart = getJSTMonthStartNMonthsAgo(now, i);
    const monthEnd = getJSTMonthStartNMonthsAgo(now, i - 1);

    const count = await countActiveUsers(monthStart, monthEnd);
    await upsertMetric('MONTH', monthStart, count);

    totalUpserted++;
  }

  console.log(`MAUバックフィル完了: ${totalUpserted}件`);
}
