/**
 * サブスクリプション同期チェックジョブ
 * DB-Stripe間の状態同期チェックを行う
 * 毎週日曜 5:00 JST に実行
 */
import { prisma, type SubscriptionStatus } from '../lib/prisma.js';
import { getStripeClient } from '../lib/stripe.js';
import { DEFAULT_BATCH_SIZE } from '../lib/constants.js';
import type Stripe from 'stripe';

/**
 * Stripe APIの期間情報を含む型
 * APIバージョンによってcurrent_period_endの位置が異なる
 */
interface PeriodData {
  current_period_end?: number;
}

/**
 * Stripeの状態をDBの状態にマッピング
 */
function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
      return 'CANCELED';
    case 'trialing':
      return 'TRIALING';
    default:
      return 'ACTIVE';
  }
}

export async function runSubscriptionSync(): Promise<void> {
  const stripe = getStripeClient();

  if (!stripe) {
    console.warn('Stripeクライアントが初期化されていません。スキップします。');
    return;
  }

  let cursor: string | undefined;
  let totalChecked = 0;
  let totalMismatched = 0;
  let totalUpdated = 0;
  let totalNotFound = 0;

  console.log('サブスクリプション同期チェックを開始します');

  do {
    // 有料サブスクリプション（externalIdが設定されているもの）を取得
    const subscriptions = await prisma.subscription.findMany({
      where: {
        externalId: { not: null },
        status: { not: 'CANCELED' }, // キャンセル済みは除外
      },
      take: DEFAULT_BATCH_SIZE,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        externalId: true,
        status: true,
        plan: true,
        currentPeriodEnd: true,
        userId: true,
        organizationId: true,
      },
    });

    if (subscriptions.length === 0) break;

    for (const subscription of subscriptions) {
      totalChecked++;

      if (!subscription.externalId) continue;

      try {
        // StripeからSubscription情報を取得
        const stripeSubscription = await stripe.subscriptions.retrieve(
          subscription.externalId
        );

        const stripeStatus = mapStripeStatus(stripeSubscription.status);

        // ステータスの不一致をチェック
        if (subscription.status !== stripeStatus) {
          totalMismatched++;

          console.log(
            `不一致検出: ${subscription.id}`,
            `DB: ${subscription.status}, Stripe: ${stripeStatus}`,
            subscription.userId
              ? `(User: ${subscription.userId})`
              : `(Org: ${subscription.organizationId})`
          );

          // DBを更新
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: stripeStatus },
          });

          // キャンセルの場合、ユーザーのプランもFREEに戻す
          if (stripeStatus === 'CANCELED' && subscription.userId) {
            await prisma.user.update({
              where: { id: subscription.userId },
              data: { plan: 'FREE' },
            });
            console.log(`ユーザー ${subscription.userId} のプランをFREEに更新`);
          }

          totalUpdated++;
        }

        // 期間終了日の不一致もチェック（大幅にずれている場合のみ）
        const stripePeriodEnd = extractPeriodEnd(stripeSubscription);
        if (stripePeriodEnd) {
          const dbPeriodEnd = subscription.currentPeriodEnd.getTime();
          const stripeEnd = stripePeriodEnd.getTime();
          // 1日以上ずれている場合
          if (Math.abs(dbPeriodEnd - stripeEnd) > 86400000) {
            console.log(
              `期間終了日の不一致: ${subscription.id}`,
              `DB: ${subscription.currentPeriodEnd.toISOString()}, ` +
                `Stripe: ${stripePeriodEnd.toISOString()}`
            );

            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { currentPeriodEnd: stripePeriodEnd },
            });
          }
        }
      } catch (error) {
        if (isStripeNotFoundError(error)) {
          // Stripeでサブスクリプションが見つからない場合
          totalNotFound++;
          console.warn(
            `Stripeでサブスクリプションが見つかりません: ${subscription.externalId}`,
            subscription.userId
              ? `(User: ${subscription.userId})`
              : `(Org: ${subscription.organizationId})`
          );

          // DBのステータスをCANCELEDに更新
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: { status: 'CANCELED' },
          });

          if (subscription.userId) {
            await prisma.user.update({
              where: { id: subscription.userId },
              data: { plan: 'FREE' },
            });
          }

          totalUpdated++;
        } else {
          console.error(
            `サブスクリプション ${subscription.id} のチェックに失敗:`,
            error
          );
        }
      }
    }

    cursor = subscriptions[subscriptions.length - 1]?.id;
  } while (cursor);

  console.log('サブスクリプション同期チェック完了:');
  console.log(`  チェック件数: ${totalChecked}`);
  console.log(`  不一致検出: ${totalMismatched}`);
  console.log(`  更新件数: ${totalUpdated}`);
  console.log(`  Stripe未検出: ${totalNotFound}`);
}

/**
 * Stripeサブスクリプションから期間終了日を取得
 * Stripe API 2025-03以降: items.data[]に期間情報が存在
 * 旧API: Subscription直下に期間情報が存在
 */
function extractPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const firstItem = subscription.items.data[0] as PeriodData | undefined;
  const sub = subscription as PeriodData;

  const periodEnd = firstItem?.current_period_end ?? sub.current_period_end;

  if (periodEnd === undefined) {
    return null;
  }

  return new Date(periodEnd * 1000);
}

/**
 * StripeのNotFoundエラーかどうかを判定
 */
function isStripeNotFoundError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'resource_missing'
  );
}
