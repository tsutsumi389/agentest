/**
 * 履歴クリーンアップジョブ
 * FREEプランユーザーの30日経過した変更履歴を削除
 * 毎日 3:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import { DEFAULT_BATCH_SIZE } from '../lib/constants.js';
import { PLAN_LIMITS } from '@agentest/shared';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'history-cleanup' });

export async function runHistoryCleanup(): Promise<void> {
  let cursor: string | undefined;
  let totalDeleted = 0;

  // FREEプランの履歴保持日数から削除基準日を算出
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - PLAN_LIMITS.FREE.changeHistoryDays);

  logger.info(
    { changeHistoryDays: PLAN_LIMITS.FREE.changeHistoryDays, cutoffDate: cutoffDate.toISOString() },
    '削除対象の履歴を検索'
  );

  do {
    // カーソルベースでFREEプランのユーザーを取得
    const users = await prisma.user.findMany({
      where: {
        subscription: { plan: 'FREE' },
      },
      take: DEFAULT_BATCH_SIZE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    if (users.length === 0) break;

    // 各ユーザーがオーナーとなっている個人プロジェクトの古い履歴を削除
    for (const user of users) {
      // ユーザーが所有する個人プロジェクト（組織に属さないプロジェクト）のIDを取得
      const ownedProjects = await prisma.projectMember.findMany({
        where: {
          userId: user.id,
          role: { in: ['OWNER', 'ADMIN'] },
          project: {
            organizationId: null, // 個人プロジェクトのみ
          },
        },
        select: { projectId: true },
      });

      if (ownedProjects.length === 0) continue;

      const projectIds = ownedProjects.map((p) => p.projectId);

      // 対象プロジェクトの古い TestCaseHistory を削除
      const testCaseHistoryResult = await prisma.testCaseHistory.deleteMany({
        where: {
          testCase: {
            testSuite: {
              projectId: { in: projectIds },
            },
          },
          createdAt: { lt: cutoffDate },
        },
      });

      // 対象プロジェクトの古い TestSuiteHistory も削除
      const testSuiteHistoryResult = await prisma.testSuiteHistory.deleteMany({
        where: {
          testSuite: {
            projectId: { in: projectIds },
          },
          createdAt: { lt: cutoffDate },
        },
      });

      // 対象プロジェクトの古い ProjectHistory も削除
      const projectHistoryResult = await prisma.projectHistory.deleteMany({
        where: {
          projectId: { in: projectIds },
          createdAt: { lt: cutoffDate },
        },
      });

      const userTotal =
        testCaseHistoryResult.count +
        testSuiteHistoryResult.count +
        projectHistoryResult.count;
      totalDeleted += userTotal;

      if (userTotal > 0) {
        logger.info(
          {
            userId: user.id,
            userTotal,
            testCaseHistory: testCaseHistoryResult.count,
            testSuiteHistory: testSuiteHistoryResult.count,
            projectHistory: projectHistoryResult.count,
          },
          'ユーザーの履歴を削除'
        );
      }
    }

    cursor = users[users.length - 1]?.id;
  } while (cursor);

  logger.info({ totalDeleted }, '古い履歴レコードの削除が完了しました');
}
