import { prisma } from '@agentest/db';
import type { MetricGranularity } from '@agentest/db';

/**
 * プラン分布集計ジョブ
 * 日次/週次/月次でプラン分布を集計し、テーブルに保存する
 */

/**
 * 指定日の週の開始日を取得（月曜日起点）
 */
function getWeekStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const dayOfWeek = result.getDay();
  // 日曜(0)の場合は6日前の月曜、それ以外は (曜日-1) 日前の月曜
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  result.setDate(result.getDate() - daysToSubtract);
  return result;
}

/**
 * 指定日の月の開始日を取得
 */
function getMonthStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(1);
  return result;
}

/**
 * 日が月末かどうかをチェック
 */
function isLastDayOfMonth(date: Date): boolean {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.getDate() === 1;
}

/**
 * 日が週末（日曜日）かどうかをチェック
 */
function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}

/**
 * プラン分布を集計して保存
 */
async function aggregateAndSave(
  date: Date,
  granularity: MetricGranularity
): Promise<void> {
  // ユーザープラン分布を集計
  const [freeUsers, proUsers] = await Promise.all([
    // FREE: サブスクリプションがない、またはFREEプラン
    prisma.user.count({
      where: {
        deletedAt: null,
        OR: [
          { subscription: null },
          { subscription: { plan: 'FREE', status: 'ACTIVE' } },
        ],
      },
    }),
    // PRO: PROプランのサブスクリプション
    prisma.user.count({
      where: {
        deletedAt: null,
        subscription: { plan: 'PRO', status: 'ACTIVE' },
      },
    }),
  ]);

  // 組織プラン分布を集計
  const [teamOrgs, enterpriseOrgs] = await Promise.all([
    prisma.organization.count({
      where: {
        deletedAt: null,
        OR: [
          { subscription: null },
          { subscription: { plan: 'TEAM', status: 'ACTIVE' } },
        ],
      },
    }),
    prisma.organization.count({
      where: {
        deletedAt: null,
        subscription: { plan: 'ENTERPRISE', status: 'ACTIVE' },
      },
    }),
  ]);

  // メンバー数を集計
  const [teamMembers, enterpriseMembers] = await Promise.all([
    prisma.organizationMember.count({
      where: {
        organization: {
          deletedAt: null,
          OR: [
            { subscription: null },
            { subscription: { plan: 'TEAM', status: 'ACTIVE' } },
          ],
        },
      },
    }),
    prisma.organizationMember.count({
      where: {
        organization: {
          deletedAt: null,
          subscription: { plan: 'ENTERPRISE', status: 'ACTIVE' },
        },
      },
    }),
  ]);

  // 粒度に応じて期間開始日を計算
  let periodStart: Date;
  switch (granularity) {
    case 'WEEK':
      periodStart = getWeekStart(date);
      break;
    case 'MONTH':
      periodStart = getMonthStart(date);
      break;
    default:
      periodStart = new Date(date);
      periodStart.setHours(0, 0, 0, 0);
  }

  // upsert で保存
  await prisma.planDistributionMetric.upsert({
    where: {
      granularity_periodStart: {
        granularity,
        periodStart,
      },
    },
    update: {
      freeUserCount: freeUsers,
      proUserCount: proUsers,
      teamOrgCount: teamOrgs,
      teamMemberCount: teamMembers,
      enterpriseOrgCount: enterpriseOrgs,
      enterpriseMemberCount: enterpriseMembers,
    },
    create: {
      granularity,
      periodStart,
      freeUserCount: freeUsers,
      proUserCount: proUsers,
      teamOrgCount: teamOrgs,
      teamMemberCount: teamMembers,
      enterpriseOrgCount: enterpriseOrgs,
      enterpriseMemberCount: enterpriseMembers,
    },
  });
}

/**
 * プラン分布を集計する
 * @param date 集計対象日（デフォルトは前日）
 */
export async function aggregatePlanDistribution(date?: Date): Promise<void> {
  // デフォルトは前日
  const targetDate = date || new Date();
  if (!date) {
    targetDate.setDate(targetDate.getDate() - 1);
  }
  targetDate.setHours(0, 0, 0, 0);

  console.log(`📊 プラン分布集計開始: ${targetDate.toISOString().split('T')[0]}`);

  try {
    // 日次で集計
    await aggregateAndSave(targetDate, 'DAY');
    console.log('  - 日次集計完了');

    // 週末（日曜日）の場合は週次も集計
    if (isSunday(targetDate)) {
      await aggregateAndSave(targetDate, 'WEEK');
      console.log('  - 週次集計完了');
    }

    // 月末の場合は月次も集計
    if (isLastDayOfMonth(targetDate)) {
      await aggregateAndSave(targetDate, 'MONTH');
      console.log('  - 月次集計完了');
    }

    console.log('✅ プラン分布集計完了');
  } catch (error) {
    console.error('❌ プラン分布集計エラー:', error);
    throw error;
  }
}

/**
 * プラン分布集計ジョブを開始
 * 毎日 00:05 JST に実行
 */
export function startPlanDistributionAggregationJob(
  intervalMs = 24 * 60 * 60 * 1000 // デフォルト: 24時間
): NodeJS.Timeout {
  const runJob = async () => {
    try {
      await aggregatePlanDistribution();
    } catch (error) {
      console.error('❌ プラン分布集計ジョブエラー:', error);
    }
  };

  // 初回実行
  runJob();

  // 定期実行
  const intervalId = setInterval(runJob, intervalMs);

  console.log(`🔄 プラン分布集計ジョブを開始しました (間隔: ${intervalMs}ms)`);

  return intervalId;
}

/**
 * ジョブを停止
 */
export function stopPlanDistributionAggregationJob(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('🛑 プラン分布集計ジョブを停止しました');
}
