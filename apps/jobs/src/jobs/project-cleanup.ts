/**
 * プロジェクトクリーンアップジョブ
 * deletedAtから30日以上経過したプロジェクトを物理削除
 * 毎日 4:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import { DEFAULT_BATCH_SIZE, PROJECT_CLEANUP_DAYS } from '../lib/constants.js';

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
  console.log(
    `削除対象: deletedAtが${PROJECT_CLEANUP_DAYS}日以上前のプロジェクト（基準日: ${cutoffDate.toISOString()}）`
  );
  console.log(`削除対象プロジェクト数: ${targetCount}件`);

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
        console.log(
          `プロジェクト削除開始: ${project.id} (${project.name}) - deletedAt: ${project.deletedAt?.toISOString()}`
        );

        // 物理削除（カスケードで関連データも削除される）
        await prisma.project.delete({
          where: { id: project.id },
        });

        totalDeleted++;
        console.log(`プロジェクト削除完了: ${project.id}`);
      } catch (error) {
        // 個別のエラーは記録して続行
        console.error(`プロジェクト削除失敗: ${project.id}`, error);
      }
    }

    cursor = projects[projects.length - 1]?.id;
  } while (cursor);

  console.log(`合計 ${totalDeleted} 件のプロジェクトを物理削除しました`);

  // 残りのソフトデリート済みプロジェクト数をレポート
  const remainingCount = await prisma.project.count({
    where: {
      deletedAt: { not: null },
    },
  });
  console.log(`残りのソフトデリート済みプロジェクト: ${remainingCount}件`);
}
