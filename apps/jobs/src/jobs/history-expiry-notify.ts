/**
 * 履歴削除予告通知ジョブ
 * 削除7日前のFREEユーザーへ通知を送信
 * 毎日 9:00 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import { sendEmail, generateHistoryExpiryEmail } from '../lib/email.js';
import { DEFAULT_BATCH_SIZE } from '../lib/constants.js';
import { PLAN_LIMITS } from '@agentest/shared';

// 削除の何日前に通知するか
const DAYS_BEFORE_DELETION = 7;

export async function runHistoryExpiryNotify(): Promise<void> {
  let cursor: string | undefined;
  let totalNotified = 0;
  let totalFailed = 0;

  // 削除対象となる日（今から (保持日数 - 通知日数前) 日前）
  const targetDate = new Date();
  targetDate.setDate(
    targetDate.getDate() -
      (PLAN_LIMITS.FREE.changeHistoryDays - DAYS_BEFORE_DELETION)
  );

  console.log(
    `通知対象: ${DAYS_BEFORE_DELETION}日後に削除される履歴を持つFREEユーザー`
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
      select: { id: true, email: true, name: true },
    });

    if (users.length === 0) break;

    for (const user of users) {
      // ユーザーが所有する個人プロジェクトのIDを取得
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

      // 削除予定の履歴数をカウント
      const historyCount = await prisma.testCaseHistory.count({
        where: {
          testCase: {
            testSuite: {
              projectId: { in: projectIds },
            },
          },
          createdAt: { lt: targetDate },
        },
      });

      // 削除予定の履歴がない場合はスキップ
      if (historyCount === 0) continue;

      // メールを送信
      try {
        const { subject, text, html } = generateHistoryExpiryEmail(
          user.name || '',
          DAYS_BEFORE_DELETION,
          historyCount
        );

        await sendEmail({
          to: user.email,
          subject,
          text,
          html,
        });

        totalNotified++;
        console.log(
          `ユーザー ${user.id} (${user.email}) に通知: ${historyCount}件の履歴が${DAYS_BEFORE_DELETION}日後に削除予定`
        );
      } catch (error) {
        totalFailed++;
        console.error(`ユーザー ${user.id} への通知送信に失敗:`, error);
      }
    }

    cursor = users[users.length - 1]?.id;
  } while (cursor);

  console.log(
    `通知完了: 成功 ${totalNotified}件, 失敗 ${totalFailed}件`
  );
}
