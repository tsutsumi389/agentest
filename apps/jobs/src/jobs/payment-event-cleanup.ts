/**
 * 決済イベントクリーンアップジョブ
 * 90日以上前の処理済みPaymentEventを削除
 * 毎週日曜 4:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';

// 処理済みイベントの保持日数
const RETENTION_DAYS = 90;

export async function runPaymentEventCleanup(): Promise<void> {
  // 削除基準日
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  console.log(
    `削除対象: ${RETENTION_DAYS}日以上前の処理済みイベント（基準日: ${cutoffDate.toISOString()}）`
  );

  // 処理済み（PROCESSED）イベントを削除
  const processedResult = await prisma.paymentEvent.deleteMany({
    where: {
      status: 'PROCESSED',
      createdAt: { lt: cutoffDate },
    },
  });

  console.log(`処理済みイベント: ${processedResult.count}件を削除`);

  // 古い失敗イベント（最大リトライ回数に達したもの）も削除
  const maxRetryCount = 5;
  const failedResult = await prisma.paymentEvent.deleteMany({
    where: {
      status: 'FAILED',
      retryCount: { gte: maxRetryCount },
      createdAt: { lt: cutoffDate },
    },
  });

  console.log(
    `失敗イベント（リトライ上限到達）: ${failedResult.count}件を削除`
  );

  const totalDeleted = processedResult.count + failedResult.count;
  console.log(`合計 ${totalDeleted} 件のイベントを削除しました`);

  // 残りのイベント数をレポート
  const remainingCounts = await prisma.paymentEvent.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  console.log('残りのイベント数:');
  for (const { status, _count } of remainingCounts) {
    console.log(`  ${status}: ${_count.status}件`);
  }
}
