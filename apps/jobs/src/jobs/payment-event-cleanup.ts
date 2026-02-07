/**
 * 決済イベントクリーンアップジョブ
 * 90日以上前の処理済みPaymentEventを削除
 * 毎週日曜 4:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import {
  MAX_RETRY_COUNT,
  PAYMENT_EVENT_RETENTION_DAYS,
} from '../lib/constants.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'payment-event-cleanup' });

export async function runPaymentEventCleanup(): Promise<void> {
  // 削除基準日
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - PAYMENT_EVENT_RETENTION_DAYS);

  logger.info(
    { retentionDays: PAYMENT_EVENT_RETENTION_DAYS, cutoffDate: cutoffDate.toISOString() },
    '削除対象の処理済みイベントを検索'
  );

  // 処理済み（PROCESSED）イベントを削除
  const processedResult = await prisma.paymentEvent.deleteMany({
    where: {
      status: 'PROCESSED',
      createdAt: { lt: cutoffDate },
    },
  });

  logger.info({ count: processedResult.count }, '処理済みイベントを削除');

  // 古い失敗イベント（最大リトライ回数に達したもの）も削除
  const failedResult = await prisma.paymentEvent.deleteMany({
    where: {
      status: 'FAILED',
      retryCount: { gte: MAX_RETRY_COUNT },
      createdAt: { lt: cutoffDate },
    },
  });

  logger.info({ count: failedResult.count }, '失敗イベント（リトライ上限到達）を削除');

  const totalDeleted = processedResult.count + failedResult.count;
  logger.info({ totalDeleted }, 'イベントの削除が完了しました');

  // 残りのイベント数をレポート
  const remainingCounts = await prisma.paymentEvent.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const remaining = Object.fromEntries(
    remainingCounts.map(({ status, _count }) => [status, _count.status])
  );
  logger.info({ remaining }, '残りのイベント数');
}
