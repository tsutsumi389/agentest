/**
 * プロジェクトクリーンアップジョブ
 * deletedAtから30日以上経過したプロジェクトを物理削除
 * 毎日 4:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import { DEFAULT_BATCH_SIZE, PROJECT_CLEANUP_DAYS } from '../lib/constants.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'project-cleanup' });

export async function runProjectCleanup(): Promise<void> {
  let cursor: string | undefined;
  let totalDeleted = 0;

  // 削除基準日を算出（30日前）
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - PROJECT_CLEANUP_DAYS);

  // 削除対象件数を事前にレポート
  const targetCount = await prisma.project.count({
    where: {
      deletedAt: { not: null, lt: cutoffDate },
    },
  });
  logger.info(
    { cleanupDays: PROJECT_CLEANUP_DAYS, cutoffDate: cutoffDate.toISOString(), targetCount },
    '削除対象のプロジェクトを検索'
  );

  do {
    // カーソルベースでソフトデリート済みプロジェクトを取得
    const projects = await prisma.project.findMany({
      where: {
        deletedAt: {
          not: null,
          lt: cutoffDate,
        },
      },
      take: DEFAULT_BATCH_SIZE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { id: 'asc' },
      select: { id: true, name: true, deletedAt: true },
    });

    if (projects.length === 0) break;

    // 各プロジェクトを物理削除
    for (const project of projects) {
      try {
        logger.info(
          {
            projectId: project.id,
            projectName: project.name,
            deletedAt: project.deletedAt?.toISOString(),
          },
          'プロジェクト削除開始'
        );

        // 物理削除（カスケードで関連データも削除される）
        await prisma.project.delete({
          where: { id: project.id },
        });

        totalDeleted++;
        logger.info({ projectId: project.id }, 'プロジェクト削除完了');
      } catch (error) {
        // 個別のエラーは記録して続行
        logger.error({ err: error, projectId: project.id }, 'プロジェクト削除失敗');
      }
    }

    cursor = projects[projects.length - 1]?.id;
  } while (cursor);

  logger.info({ totalDeleted }, 'プロジェクトの物理削除が完了しました');

  // 残りのソフトデリート済みプロジェクト数をレポート
  const remainingCount = await prisma.project.count({
    where: {
      deletedAt: { not: null },
    },
  });
  logger.info({ remainingCount }, '残りのソフトデリート済みプロジェクト');
}
