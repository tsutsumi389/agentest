/**
 * プロジェクトオーナーをProjectMemberテーブルに移行するスクリプト
 *
 * 注意: このスクリプトはProject.ownerIdカラムを削除する前に実行すること！
 *
 * 実行方法:
 *   docker compose exec dev pnpm tsx packages/db/scripts/migrate-project-owners.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateProjectOwners() {
  console.log('プロジェクトオーナーのマイグレーションを開始します...');

  // ownerIdが設定されている全てのプロジェクトを取得（削除済みも含む）
  const projects = await prisma.project.findMany({
    where: {
      ownerId: { not: null },
    },
    select: {
      id: true,
      ownerId: true,
      name: true,
    },
  });

  console.log(`対象プロジェクト数: ${projects.length}`);

  if (projects.length === 0) {
    console.log('マイグレーション対象のプロジェクトがありません。');
    return;
  }

  // トランザクションで一括処理
  const results = await prisma.$transaction(
    projects.map((project) =>
      prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: project.ownerId!,
          },
        },
        create: {
          projectId: project.id,
          userId: project.ownerId!,
          role: 'OWNER',
        },
        update: {
          role: 'OWNER',
        },
      })
    )
  );

  console.log(`マイグレーション完了: ${results.length}件のオーナーをProjectMemberに登録しました`);

  // 結果の確認
  for (const project of projects) {
    console.log(`  - ${project.name} (${project.id}): オーナー ${project.ownerId}`);
  }
}

migrateProjectOwners()
  .catch((error) => {
    console.error('マイグレーションエラー:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
