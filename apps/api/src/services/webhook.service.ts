/**
 * Webhookサービス
 * Stripeからのwebhookイベントを処理するビジネスロジック
 */

import { prisma } from '@agentest/db';
import type { WebhookEvent } from '../gateways/payment/types.js';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { logger } from '../utils/logger.js';

/**
 * Stripe Invoiceオブジェクトの型（webhookイベントデータ用）
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
 * Stripe Subscriptionオブジェクトの型（webhookイベントデータ用）
 * Stripe API 2025-03-31以降: current_period_start/endはitems.data[]に存在
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
  };
}

/**
 * Webhookサービス
 */
export class WebhookService {
  private subscriptionRepo = new SubscriptionRepository();
  private invoiceRepo = new InvoiceRepository();
  private userRepo = new UserRepository();

  /**
   * イベントディスパッチャ
   * イベントタイプに応じたハンドラを呼び出す
   */
  async handleEvent(event: WebhookEvent): Promise<void> {
    logger.info('Webhook event received', {
      eventId: event.id,
      eventType: event.type,
    });

    switch (event.type) {
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as StripeInvoiceData);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as StripeInvoiceData);
        break;
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as StripeSubscriptionData);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as StripeSubscriptionData);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as StripeSubscriptionData);
        break;
      default:
        logger.warn('Unhandled webhook event type', {
          eventId: event.id,
          eventType: event.type,
        });
        break;
    }
  }

  /**
   * 請求書支払い完了
   * Invoiceレコードを作成/更新（status=PAID）
   */
  private async handleInvoicePaid(data: StripeInvoiceData): Promise<void> {
    const subscriptionExternalId = data.subscription;
    if (!subscriptionExternalId) {
      logger.warn('Invoice paid event has no subscription', { invoiceId: data.id });
      return;
    }

    const subscription = await this.subscriptionRepo.findByExternalId(subscriptionExternalId);
    if (!subscription) {
      logger.warn('Subscription not found for invoice', {
        invoiceId: data.id,
        subscriptionExternalId,
      });
      return;
    }

    const invoiceNumber = data.number ?? data.id;
    await this.invoiceRepo.upsertByInvoiceNumber(invoiceNumber, {
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
      pdfUrl: data.invoice_pdf,
    });

    logger.info('Invoice paid processed', {
      invoiceNumber,
      subscriptionId: subscription.id,
    });
  }

  /**
   * 支払い失敗
   * Invoiceレコードを作成/更新（status=FAILED）、サブスクリプションをPAST_DUEに更新
   * トランザクションで一貫性を保証
   */
  private async handleInvoicePaymentFailed(data: StripeInvoiceData): Promise<void> {
    const subscriptionExternalId = data.subscription;
    if (!subscriptionExternalId) {
      logger.warn('Invoice payment failed event has no subscription', { invoiceId: data.id });
      return;
    }

    const subscription = await this.subscriptionRepo.findByExternalId(subscriptionExternalId);
    if (!subscription) {
      logger.warn('Subscription not found for failed invoice', {
        invoiceId: data.id,
        subscriptionExternalId,
      });
      return;
    }

    const invoiceNumber = data.number ?? data.id;

    // InvoiceのupsertとSubscriptionのstatus更新をトランザクションで実行
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

    logger.info('Invoice payment failed processed', {
      invoiceNumber,
      subscriptionId: subscription.id,
    });
  }

  /**
   * サブスクリプション作成
   * 通常はcreateSubscription時にDB書き込み済みのため、未登録時のみ作成
   */
  private async handleSubscriptionCreated(data: StripeSubscriptionData): Promise<void> {
    const existing = await this.subscriptionRepo.findByExternalId(data.id);
    if (existing) {
      logger.info('Subscription already exists, skipping creation', {
        externalId: data.id,
        subscriptionId: existing.id,
      });
      return;
    }

    // metadataからユーザーIDを取得
    const userId = data.metadata.userId;
    if (!userId) {
      logger.warn('Subscription created event has no userId in metadata', {
        externalId: data.id,
      });
      return;
    }

    const period = this.extractPeriod(data);
    if (!period) {
      logger.warn('Subscription has no period data', { externalId: data.id });
      return;
    }

    const plan = this.mapPlan(data.metadata.plan);
    const billingCycle = this.mapBillingCycle(data.metadata.billingCycle);

    await this.subscriptionRepo.upsertForUser(userId, {
      externalId: data.id,
      plan,
      billingCycle,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      status: this.mapSubscriptionStatus(data.status),
      cancelAtPeriodEnd: data.cancel_at_period_end,
    });

    logger.info('Subscription created via webhook', {
      externalId: data.id,
      userId,
      plan,
    });
  }

  /**
   * サブスクリプション更新
   * plan, billingCycle, status, currentPeriodStart/End, cancelAtPeriodEndをDB同期
   */
  private async handleSubscriptionUpdated(data: StripeSubscriptionData): Promise<void> {
    const subscription = await this.subscriptionRepo.findByExternalId(data.id);
    if (!subscription) {
      logger.warn('Subscription not found for update', { externalId: data.id });
      return;
    }

    const period = this.extractPeriod(data);
    if (!period) {
      logger.warn('Subscription has no period data', { externalId: data.id });
      return;
    }

    await this.subscriptionRepo.update(subscription.id, {
      plan: this.mapPlan(data.metadata.plan),
      billingCycle: this.mapBillingCycle(data.metadata.billingCycle),
      status: this.mapSubscriptionStatus(data.status),
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      cancelAtPeriodEnd: data.cancel_at_period_end,
    });

    logger.info('Subscription updated via webhook', {
      externalId: data.id,
      subscriptionId: subscription.id,
      status: data.status,
    });
  }

  /**
   * サブスクリプション削除
   * SubscriptionのstatusをCANCELED、User.planをFREEに更新
   */
  private async handleSubscriptionDeleted(data: StripeSubscriptionData): Promise<void> {
    const subscription = await this.subscriptionRepo.findByExternalId(data.id);
    if (!subscription) {
      logger.warn('Subscription not found for deletion', { externalId: data.id });
      return;
    }

    // サブスクリプションのステータスをCANCELEDに更新
    await this.subscriptionRepo.update(subscription.id, {
      status: 'CANCELED',
    });

    // ユーザーのプランをFREEに更新
    if (subscription.userId) {
      await this.userRepo.updatePlan(subscription.userId, 'FREE');
    }

    logger.info('Subscription deleted via webhook', {
      externalId: data.id,
      subscriptionId: subscription.id,
      userId: subscription.userId,
    });
  }

  /**
   * StripeSubscriptionDataから期間情報を取得
   * Stripe API 2025-03-31以降: items.data[]にperiodが存在
   * 旧API: Subscription直下にperiodが存在
   * 両方にフォールバック対応
   */
  private extractPeriod(
    data: StripeSubscriptionData
  ): { start: Date; end: Date } | null {
    const firstItem = data.items.data[0];
    const periodStart =
      firstItem?.current_period_start ?? data.current_period_start;
    const periodEnd =
      firstItem?.current_period_end ?? data.current_period_end;

    if (periodStart === undefined || periodEnd === undefined) {
      return null;
    }

    return {
      start: new Date(periodStart * 1000),
      end: new Date(periodEnd * 1000),
    };
  }

  /**
   * Stripeのプランメタデータを内部のSubscriptionPlanにマッピング
   */
  private mapPlan(plan?: string): 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE' {
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

  /**
   * Stripeの請求サイクルメタデータを内部のBillingCycleにマッピング
   */
  private mapBillingCycle(cycle?: string): 'MONTHLY' | 'YEARLY' {
    return cycle === 'YEARLY' ? 'YEARLY' : 'MONTHLY';
  }

  /**
   * StripeのサブスクリプションステータスをDBのSubscriptionStatusにマッピング
   * incomplete / incomplete_expired / paused はDBスキーマに対応するステータスがないため
   * 警告ログを出力しACTIVEにフォールバックする
   */
  private mapSubscriptionStatus(
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
        logger.warn('Unknown subscription status, defaulting to ACTIVE', {
          stripeStatus: status,
        });
        return 'ACTIVE';
    }
  }
}
