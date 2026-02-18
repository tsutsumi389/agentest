/**
 * 履歴クリーンアップジョブ
 * 保持期間を超えた変更履歴を削除
 * 毎日 3:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'history-cleanup' });

/** デフォルト履歴保持日数 */
const DEFAULT_HISTORY_RETENTION_DAYS = 30;

/** 履歴保持日数の上限 */
const MAX_HISTORY_RETENTION_DAYS = 365;

/** 環境変数から履歴保持日数を取得（無効値はデフォルトにフォールバック） */
function getHistoryRetentionDays(): number {
  const envValue = process.env.HISTORY_RETENTION_DAYS;
  if (envValue === undefined) {
    return DEFAULT_HISTORY_RETENTION_DAYS;
  }

  const parsed = parseInt(envValue, 10);
  if (isNaN(parsed) || parsed <= 0 || parsed > MAX_HISTORY_RETENTION_DAYS) {
    logger.warn(
      { value: envValue, default: DEFAULT_HISTORY_RETENTION_DAYS, max: MAX_HISTORY_RETENTION_DAYS },
      'HISTORY_RETENTION_DAYS が無効な値です。デフォルト値を使用します'
    );
    return DEFAULT_HISTORY_RETENTION_DAYS;
  }

  return parsed;
}

export async function runHistoryCleanup(): Promise<void> {
  const retentionDays = getHistoryRetentionDays();

  // 削除基準日を算出
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  logger.info(
    { historyRetentionDays: retentionDays, cutoffDate: cutoffDate.toISOString() },
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
