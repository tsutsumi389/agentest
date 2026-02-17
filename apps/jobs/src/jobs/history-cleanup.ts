/**
 * 履歴クリーンアップジョブ
 * 30日経過した変更履歴を削除
 * 毎日 3:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'history-cleanup' });

/** 履歴保持日数 */
const HISTORY_RETENTION_DAYS = 30;

export async function runHistoryCleanup(): Promise<void> {
  // 削除基準日を算出
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - HISTORY_RETENTION_DAYS);

  logger.info(
    { historyRetentionDays: HISTORY_RETENTION_DAYS, cutoffDate: cutoffDate.toISOString() },
    '削除対象の履歴を検索'
  );

  // 古い TestCaseHistory を削除
  const testCaseHistoryResult = await prisma.testCaseHistory.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  // 古い TestSuiteHistory を削除
  const testSuiteHistoryResult = await prisma.testSuiteHistory.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  // 古い ProjectHistory を削除
  const projectHistoryResult = await prisma.projectHistory.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
    },
  });

  const totalDeleted =
    testCaseHistoryResult.count +
    testSuiteHistoryResult.count +
    projectHistoryResult.count;

  logger.info(
    {
      totalDeleted,
      testCaseHistory: testCaseHistoryResult.count,
      testSuiteHistory: testSuiteHistoryResult.count,
      projectHistory: projectHistoryResult.count,
    },
    '古い履歴レコードの削除が完了しました'
  );
}
