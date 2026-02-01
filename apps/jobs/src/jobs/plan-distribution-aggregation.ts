/**
 * プラン分布集計ジョブ
 * 日次/週次/月次でプラン分布を集計してテーブルに保存
 * 毎日 00:05 JST に実行
 */
import { prisma } from '../lib/prisma.js';
import type { MetricGranularity } from '@agentest/db';
import {
  getJSTYesterdayStart,
  getJSTDayOfWeek,
  getJSTDayOfMonth,
  getJSTLastMonday,
  getJSTLastMonthStart,
  formatDateStringJST,
} from '../lib/date-utils.js';

/** 集計結果の型 */
interface AggregationResult {
  freeUsers: number;
  proUsers: number;
  teamOrgs: number;
  enterpriseOrgs: number;
  teamMembers: number;
  enterpriseMembers: number;
}

/**
 * プラン分布を集計してテーブルに保存
 */
async function aggregateAndSave(
  periodStart: Date,
  granularity: MetricGranularity
): Promise<AggregationResult> {
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

  // upsertで保存（再実行時も安全）
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

  return { freeUsers, proUsers, teamOrgs, enterpriseOrgs, teamMembers, enterpriseMembers };
}

/**
 * DAY粒度の集計（前日分）
 */
async function aggregateDAY(now: Date): Promise<void> {
  const yesterday = getJSTYesterdayStart(now);
  const result = await aggregateAndSave(yesterday, 'DAY');
  console.log(
    `DAY ${formatDateStringJST(yesterday)}: FREE=${result.freeUsers}, PRO=${result.proUsers}, ` +
    `TEAM=${result.teamOrgs}(${result.teamMembers}), ENT=${result.enterpriseOrgs}(${result.enterpriseMembers})`
  );
}

/**
 * WEEK粒度の集計（前週分）
 * 今日が月曜日の場合に実行
 */
async function aggregateWEEK(now: Date): Promise<void> {
  // 直近の月曜日（今日が月曜なら今日）から7日前の月曜日
  const thisMonday = getJSTLastMonday(now);
  const lastMonday = new Date(thisMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
  const result = await aggregateAndSave(lastMonday, 'WEEK');
  console.log(
    `WEEK ${formatDateStringJST(lastMonday)}: FREE=${result.freeUsers}, PRO=${result.proUsers}, ` +
    `TEAM=${result.teamOrgs}(${result.teamMembers}), ENT=${result.enterpriseOrgs}(${result.enterpriseMembers})`
  );
}

/**
 * MONTH粒度の集計（前月分）
 * 月初（1日）に実行
 */
async function aggregateMONTH(now: Date): Promise<void> {
  const lastMonthStart = getJSTLastMonthStart(now);
  const result = await aggregateAndSave(lastMonthStart, 'MONTH');
  console.log(
    `MONTH ${formatDateStringJST(lastMonthStart)}: FREE=${result.freeUsers}, PRO=${result.proUsers}, ` +
    `TEAM=${result.teamOrgs}(${result.teamMembers}), ENT=${result.enterpriseOrgs}(${result.enterpriseMembers})`
  );
}

/**
 * プラン分布集計ジョブのエントリーポイント
 */
export async function runPlanDistributionAggregation(): Promise<void> {
  const now = new Date();

  console.log(`プラン分布集計開始: ${now.toISOString()}`);

  // 前日のDAY集計
  await aggregateDAY(now);

  // 月曜日（getJSTDayOfWeek === 1）の場合、前週のWEEK集計
  if (getJSTDayOfWeek(now) === 1) {
    await aggregateWEEK(now);
  }

  // 月初（getJSTDayOfMonth === 1）の場合、前月のMONTH集計
  if (getJSTDayOfMonth(now) === 1) {
    await aggregateMONTH(now);
  }

  console.log('プラン分布集計完了');
}
