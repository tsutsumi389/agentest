/**
 * メトリクス集計ジョブ
 * DAU/WAU/MAUを集計してテーブルに保存
 * 毎日 1:00 JST に実行
 */
import { countActiveUsers, upsertMetric } from '../lib/metrics-utils.js';
import {
  getJSTYesterdayStart,
  getJSTStartOfDay,
  getJSTDayOfWeek,
  getJSTDayOfMonth,
  getJSTLastMonday,
  getJSTLastMonthStart,
  getJSTThisMonthStart,
  formatDateStringJST,
} from '../lib/date-utils.js';

/**
 * メトリクス集計ジョブのエントリーポイント
 */
export async function runMetricsAggregation(): Promise<void> {
  const now = new Date();

  console.log(`メトリクス集計開始: ${now.toISOString()}`);

  // 前日のDAU集計
  await aggregateDAU(now);

  // 週初（月曜）の場合、前週のWAU集計
  if (getJSTDayOfWeek(now) === 1) {
    await aggregateWAU(now);
  }

  // 月初の場合、前月のMAU集計
  if (getJSTDayOfMonth(now) === 1) {
    await aggregateMAU(now);
  }

  console.log('メトリクス集計完了');
}

/**
 * DAU（日次アクティブユーザー）集計
 */
async function aggregateDAU(now: Date): Promise<void> {
  // 前日の開始・終了を計算（JST基準）
  const yesterday = getJSTYesterdayStart(now);
  const today = getJSTStartOfDay(now);

  // 前日にアクティブだったユニークユーザー数をカウント
  const count = await countActiveUsers(yesterday, today);

  // upsertで保存（再実行時も安全）
  await upsertMetric('DAY', yesterday, count);

  console.log(`DAU ${formatDateStringJST(yesterday)}: ${count}`);
}

/**
 * WAU（週次アクティブユーザー）集計
 */
async function aggregateWAU(now: Date): Promise<void> {
  // 前週の月曜日を計算（今日が月曜なら7日前の月曜日）
  const thisMonday = getJSTLastMonday(now);
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 前週にアクティブだったユニークユーザー数をカウント
  const count = await countActiveUsers(lastMonday, thisMonday);

  await upsertMetric('WEEK', lastMonday, count);

  console.log(`WAU ${formatDateStringJST(lastMonday)}: ${count}`);
}

/**
 * MAU（月次アクティブユーザー）集計
 */
async function aggregateMAU(now: Date): Promise<void> {
  // 前月の1日と当月の1日を計算（JST基準）
  const lastMonthStart = getJSTLastMonthStart(now);
  const thisMonthStart = getJSTThisMonthStart(now);

  // 前月にアクティブだったユニークユーザー数をカウント
  const count = await countActiveUsers(lastMonthStart, thisMonthStart);

  await upsertMetric('MONTH', lastMonthStart, count);

  console.log(`MAU ${formatDateStringJST(lastMonthStart)}: ${count}`);
}
