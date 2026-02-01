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
  formatDateStringJST,
} from '../lib/date-utils.js';

// デフォルトのバックフィル期間（日数）
const DEFAULT_BACKFILL_DAYS = 90;

// 1日のミリ秒
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// JSTオフセット（ミリ秒）
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

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

  // JSTで現在の月を計算
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  const currentYear = jstNow.getUTCFullYear();
  const currentMonth = jstNow.getUTCMonth();

  for (let i = 1; i <= months; i++) {
    // i ヶ月前の月を計算
    let targetMonth = currentMonth - i;
    let targetYear = currentYear;
    while (targetMonth < 0) {
      targetMonth += 12;
      targetYear -= 1;
    }

    // 対象月の開始・終了（JSTで計算してUTCに変換）
    const monthStartJST = new Date(Date.UTC(targetYear, targetMonth, 1));
    const monthStart = new Date(monthStartJST.getTime() - JST_OFFSET_MS);

    // 翌月の開始
    let nextMonth = targetMonth + 1;
    let nextYear = targetYear;
    if (nextMonth > 11) {
      nextMonth = 0;
      nextYear += 1;
    }
    const monthEndJST = new Date(Date.UTC(nextYear, nextMonth, 1));
    const monthEnd = new Date(monthEndJST.getTime() - JST_OFFSET_MS);

    const count = await countActiveUsers(monthStart, monthEnd);
    await upsertMetric('MONTH', monthStart, count);

    totalUpserted++;
  }

  console.log(`MAUバックフィル完了: ${totalUpserted}件`);
}
