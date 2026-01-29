/**
 * Webhook再処理ジョブ
 * 処理失敗したWebhookイベント（PaymentEvent）を再処理
 * 毎時 0分 に実行
 */
import { prisma } from '../lib/prisma.js';
import { MAX_RETRY_COUNT, DEFAULT_BATCH_SIZE } from '../lib/constants.js';

/**
 * Stripe Invoiceオブジェクトの型
 */
interface StripeInvoiceData {
  id: string;
  number: string | null;
  subscription: string | null;
  customer: string | null;
  amount_due: number;
  currency: string;
  status: string;
  period_start: number;
  period_end: number;
  due_date: number | null;
  invoice_pdf: string | null;
}

/**
 * Stripe Subscriptionオブジェクトの型
 */
interface StripeSubscriptionData {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start?: number;
  current_period_end?: number;
  items: {
    data: Array<{
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
  metadata: {
    plan?: string;
    billingCycle?: string;
    userId?: string;
    organizationId?: string;
  };
}

/**
 * WebhookEventの型
 */
interface WebhookEvent {
  id: string;
  type: string;
  data: {
    object: StripeInvoiceData | StripeSubscriptionData;
  };
}

export async function runWebhookRetry(): Promise<void> {
  let totalRetried = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  // FAILEDステータスでリトライ回数が上限未満のイベントを取得
  const failedEvents = await prisma.paymentEvent.findMany({
    where: {
      status: 'FAILED',
      retryCount: { lt: MAX_RETRY_COUNT },
    },
    orderBy: { createdAt: 'asc' },
    take: DEFAULT_BATCH_SIZE,
  });

  if (failedEvents.length === 0) {
    console.log('リトライ対象のイベントはありません');
    return;
  }

  console.log(`${failedEvents.length}件の失敗イベントを再処理します`);

  for (const event of failedEvents) {
    totalRetried++;

    try {
      // payloadからWebhookEventを復元
      const webhookEvent = event.payload as unknown as WebhookEvent;

      // イベントタイプに応じた処理
      await processEvent(webhookEvent);

      // 成功: PROCESSEDに更新
      await prisma.paymentEvent.update({
        where: { id: event.id },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          errorMessage: null,
        },
      });

      totalSucceeded++;
      console.log(
        `イベント ${event.externalId} (${event.eventType}) の再処理に成功`
      );
    } catch (error) {
      // 失敗: retryCountをインクリメント
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await prisma.paymentEvent.update({
        where: { id: event.id },
        data: {
          errorMessage,
          retryCount: { increment: 1 },
        },
      });

      totalFailed++;
      console.error(
        `イベント ${event.externalId} (${event.eventType}) の再処理に失敗: ${errorMessage}`
      );
    }
  }

  console.log(
    `再処理完了: 成功 ${totalSucceeded}件, 失敗 ${totalFailed}件 (合計 ${totalRetried}件)`
  );

  // 最大リトライ回数に達したイベントを警告
  const maxRetriedEvents = await prisma.paymentEvent.count({
    where: {
      status: 'FAILED',
      retryCount: { gte: MAX_RETRY_COUNT },
    },
  });

  if (maxRetriedEvents > 0) {
    console.warn(
      `警告: ${maxRetriedEvents}件のイベントが最大リトライ回数（${MAX_RETRY_COUNT}回）に達しました`
    );
  }
}

/**
 * イベントタイプに応じた処理
 */
async function processEvent(webhookEvent: WebhookEvent): Promise<void> {
  switch (webhookEvent.type) {
    case 'invoice.paid':
      await handleInvoicePaid(webhookEvent.data.object as StripeInvoiceData);
      break;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(
        webhookEvent.data.object as StripeInvoiceData
      );
      break;
    case 'customer.subscription.created':
      await handleSubscriptionCreated(
        webhookEvent.data.object as StripeSubscriptionData
      );
      break;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(
        webhookEvent.data.object as StripeSubscriptionData
      );
      break;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(
        webhookEvent.data.object as StripeSubscriptionData
      );
      break;
    default:
      // 未対応のイベントタイプは成功扱い
      console.log(`未対応のイベントタイプ: ${webhookEvent.type}`);
      break;
  }
}

/**
 * 請求書支払い完了処理
 */
async function handleInvoicePaid(data: StripeInvoiceData): Promise<void> {
  const subscriptionExternalId = data.subscription;
  if (!subscriptionExternalId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { externalId: subscriptionExternalId },
  });
  if (!subscription) return;

  const invoiceNumber = data.number ?? data.id;

  await prisma.invoice.upsert({
    where: { invoiceNumber },
    create: {
      subscriptionId: subscription.id,
      invoiceNumber,
      amount: data.amount_due,
      currency: data.currency,
      status: 'PAID',
      periodStart: new Date(data.period_start * 1000),
      periodEnd: new Date(data.period_end * 1000),
      dueDate: data.due_date
        ? new Date(data.due_date * 1000)
        : new Date(data.period_start * 1000),
      pdfUrl: data.invoice_pdf ?? null,
    },
    update: {
      amount: data.amount_due,
      currency: data.currency,
      status: 'PAID',
      periodStart: new Date(data.period_start * 1000),
      periodEnd: new Date(data.period_end * 1000),
      dueDate: data.due_date
        ? new Date(data.due_date * 1000)
        : new Date(data.period_start * 1000),
      pdfUrl: data.invoice_pdf ?? null,
    },
  });
}

/**
 * 支払い失敗処理
 */
async function handleInvoicePaymentFailed(
  data: StripeInvoiceData
): Promise<void> {
  const subscriptionExternalId = data.subscription;
  if (!subscriptionExternalId) return;

  const subscription = await prisma.subscription.findUnique({
    where: { externalId: subscriptionExternalId },
  });
  if (!subscription) return;

  const invoiceNumber = data.number ?? data.id;

  await prisma.$transaction(async (tx) => {
    await tx.invoice.upsert({
      where: { invoiceNumber },
      create: {
        subscriptionId: subscription.id,
        invoiceNumber,
        amount: data.amount_due,
        currency: data.currency,
        status: 'FAILED',
        periodStart: new Date(data.period_start * 1000),
        periodEnd: new Date(data.period_end * 1000),
        dueDate: data.due_date
          ? new Date(data.due_date * 1000)
          : new Date(data.period_start * 1000),
        pdfUrl: data.invoice_pdf ?? null,
      },
      update: {
        amount: data.amount_due,
        currency: data.currency,
        status: 'FAILED',
        periodStart: new Date(data.period_start * 1000),
        periodEnd: new Date(data.period_end * 1000),
        dueDate: data.due_date
          ? new Date(data.due_date * 1000)
          : new Date(data.period_start * 1000),
        pdfUrl: data.invoice_pdf ?? null,
      },
    });

    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: 'PAST_DUE' },
    });
  });
}

/**
 * サブスクリプション作成処理
 */
async function handleSubscriptionCreated(
  data: StripeSubscriptionData
): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { externalId: data.id },
  });
  if (existing) return;

  const userId = data.metadata.userId;
  const organizationId = data.metadata.organizationId;

  if (!userId && !organizationId) return;

  const period = extractPeriod(data);
  if (!period) return;

  const plan = mapPlan(data.metadata.plan);
  const billingCycle = mapBillingCycle(data.metadata.billingCycle);
  const status = mapSubscriptionStatus(data.status);

  if (organizationId) {
    await prisma.subscription.upsert({
      where: { organizationId },
      create: {
        organizationId,
        externalId: data.id,
        plan,
        billingCycle,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        status,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      },
      update: {
        externalId: data.id,
        plan,
        billingCycle,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        status,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      },
    });
  } else if (userId) {
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        externalId: data.id,
        plan,
        billingCycle,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        status,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      },
      update: {
        externalId: data.id,
        plan,
        billingCycle,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        status,
        cancelAtPeriodEnd: data.cancel_at_period_end,
      },
    });
  }
}

/**
 * サブスクリプション更新処理
 */
async function handleSubscriptionUpdated(
  data: StripeSubscriptionData
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { externalId: data.id },
  });
  if (!subscription) return;

  const period = extractPeriod(data);
  if (!period) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      plan: mapPlan(data.metadata.plan),
      billingCycle: mapBillingCycle(data.metadata.billingCycle),
      status: mapSubscriptionStatus(data.status),
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
    },
  });
}

/**
 * サブスクリプション削除処理
 */
async function handleSubscriptionDeleted(
  data: StripeSubscriptionData
): Promise<void> {
  const subscription = await prisma.subscription.findUnique({
    where: { externalId: data.id },
  });
  if (!subscription) return;

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: 'CANCELED' },
  });

  // ユーザー向け: プランをFREEに更新
  if (subscription.userId) {
    await prisma.user.update({
      where: { id: subscription.userId },
      data: { plan: 'FREE' },
    });
  }
}

/**
 * ユーティリティ関数
 */
function extractPeriod(
  data: StripeSubscriptionData
): { start: Date; end: Date } | null {
  const firstItem = data.items.data[0];
  const periodStart =
    firstItem?.current_period_start ?? data.current_period_start;
  const periodEnd = firstItem?.current_period_end ?? data.current_period_end;

  if (periodStart === undefined || periodEnd === undefined) {
    return null;
  }

  return {
    start: new Date(periodStart * 1000),
    end: new Date(periodEnd * 1000),
  };
}

function mapPlan(plan?: string): 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE' {
  switch (plan) {
    case 'PRO':
      return 'PRO';
    case 'TEAM':
      return 'TEAM';
    case 'ENTERPRISE':
      return 'ENTERPRISE';
    default:
      return 'PRO';
  }
}

function mapBillingCycle(cycle?: string): 'MONTHLY' | 'YEARLY' {
  return cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
}

function mapSubscriptionStatus(
  status: string
): 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING' {
  switch (status) {
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
