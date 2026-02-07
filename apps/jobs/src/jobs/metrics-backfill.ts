/**
 * メトリクスバックフィルジョブ
 * 過去のセッションデータからDAU/WAU/MAUを集計してテーブルに投入
 * 初回デプロイ時または手動実行用
 *
 * 環境変数:
 * - BACKFILL_DAYS: 遡る日数（デフォルト: 90日）
 */
import { countActiveUsers, upsertMetric } from '../lib/metrics-utils.js';
import { logger as baseLogger } from '../utils/logger.js';
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

const logger = baseLogger.child({ module: 'metrics-backfill' });

/**
 * メトリクスバックフィルジョブのエントリーポイント
 */
export async function runMetricsBackfill(): Promise<void> {
  const backfillDays = parseInt(
    process.env.BACKFILL_DAYS || String(DEFAULT_BACKFILL_DAYS),
    10
  );

  logger.info({ backfillDays }, 'メトリクスバックフィル開始');

  const now = new Date();

  // DAUをバックフィル
  await backfillDAU(now, backfillDays);

  // WAUをバックフィル
  await backfillWAU(now, backfillDays);

  // MAUをバックフィル
  await backfillMAU(now, backfillDays);

  logger.info('メトリクスバックフィル完了');
}

/**
 * DAU（日次アクティブユーザー）のバックフィル
 */
async function backfillDAU(now: Date, days: number): Promise<void> {
  logger.info({ days }, 'DAUバックフィル開始');

  let totalUpserted = 0;
  const todayStart = getJSTStartOfDay(now);

  for (let i = 1; i <= days; i++) {
    const targetDate = new Date(todayStart.getTime() - i * ONE_DAY_MS);
    const nextDate = new Date(targetDate.getTime() + ONE_DAY_MS);

    const count = await countActiveUsers(targetDate, nextDate);
    await upsertMetric('DAY', targetDate, count);

    totalUpserted++;
    if (i % 30 === 0) {
      logger.info(
        { progress: i, total: days, date: formatDateStringJST(targetDate), count },
        'DAUバックフィル進捗'
      );
    }
  }

  logger.info({ totalUpserted }, 'DAUバックフィル完了');
}

/**
 * WAU（週次アクティブユーザー）のバックフィル
 */
async function backfillWAU(now: Date, days: number): Promise<void> {
  // 週数を計算
  const weeks = Math.ceil(days / 7);
  logger.info({ weeks }, 'WAUバックフィル開始');

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

  logger.info({ totalUpserted }, 'WAUバックフィル完了');
}

/**
 * MAU（月次アクティブユーザー）のバックフィル
 */
async function backfillMAU(now: Date, days: number): Promise<void> {
  // 月数を計算
  const months = Math.ceil(days / 30);
  logger.info({ months }, 'MAUバックフィル開始');

  let totalUpserted = 0;

  for (let i = 1; i <= months; i++) {
    // i ヶ月前と (i-1) ヶ月前の月初を取得
    const monthStart = getJSTMonthStartNMonthsAgo(now, i);
    const monthEnd = getJSTMonthStartNMonthsAgo(now, i - 1);

    const count = await countActiveUsers(monthStart, monthEnd);
    await upsertMetric('MONTH', monthStart, count);

    totalUpserted++;
  }

  logger.info({ totalUpserted }, 'MAUバックフィル完了');
}
