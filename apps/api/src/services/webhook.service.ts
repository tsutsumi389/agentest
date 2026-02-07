/**
 * Webhookサービス
 * Stripeからのwebhookイベントを処理するビジネスロジック
 */

import { prisma } from '@agentest/db';
import type { WebhookEvent } from '../gateways/payment/types.js';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { InvoiceRepository } from '../repositories/invoice.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { PaymentEventRepository } from '../repositories/payment-event.repository.js';
import {
  invalidateUserInvoicesCache,
  invalidateOrgInvoicesCache,
} from '../lib/redis-store.js';
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
    organizationId?: string;
  };
}

/**
 * Webhookサービス
 */
export class WebhookService {
  private subscriptionRepo = new SubscriptionRepository();
  private invoiceRepo = new InvoiceRepository();
  private userRepo = new UserRepository();
  private paymentEventRepo = new PaymentEventRepository();

  /**
   * イベントディスパッチャ
   * イベントタイプに応じたハンドラを呼び出す
   * PaymentEventによる冪等性を保証
   */
  async handleEvent(event: WebhookEvent): Promise<{ duplicate: boolean }> {
    logger.info({
      eventId: event.id,
      eventType: event.type,
    }, 'Webhook event received');

    // 冪等性チェック: 既に処理済みのイベントはスキップ
    const existingEvent = await this.paymentEventRepo.findByExternalId(event.id);
    if (existingEvent) {
      logger.info({
        eventId: event.id,
        eventType: event.type,
        existingStatus: existingEvent.status,
      }, 'Duplicate webhook event, skipping');
      return { duplicate: true };
    }

    // PaymentEventを作成（PENDING状態）
    // WebhookEventをJSONとして保存するため、JSON.parse/stringifyでシリアライズ可能な形に変換
    let paymentEvent;
    try {
      paymentEvent = await this.paymentEventRepo.create({
        externalId: event.id,
        eventType: event.type,
        payload: JSON.parse(JSON.stringify(event)),
      });
    } catch (error) {
      // 同時リクエストでユニーク制約違反が発生した場合は重複として扱う
      if (this.isUniqueConstraintViolation(error)) {
        logger.info({
          eventId: event.id,
          eventType: event.type,
        }, 'Duplicate webhook event (race condition), skipping');
        return { duplicate: true };
      }
      throw error;
    }

    try {
      // イベントタイプに応じた処理
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
          // 未対応のイベントタイプ（今後対応予定のイベントが多いためdebugレベル）
          logger.debug({
            eventId: event.id,
            eventType: event.type,
          }, 'Unhandled webhook event type');
          break;
      }

      // 処理成功: PaymentEventをPROCESSEDに更新
      await this.paymentEventRepo.markAsProcessed(paymentEvent.id);
      return { duplicate: false };
    } catch (error) {
      // 処理失敗: PaymentEventをFAILEDに更新
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.paymentEventRepo.markAsFailed(paymentEvent.id, errorMessage);
      logger.error({
        eventId: event.id,
        eventType: event.type,
        error: errorMessage,
      }, 'Webhook event processing failed');
      throw error;
    }
  }

  /**
   * 請求書支払い完了
   * Invoiceレコードを作成/更新（status=PAID）
   * キャッシュ無効化
   */
  private async handleInvoicePaid(data: StripeInvoiceData): Promise<void> {
    const subscriptionExternalId = data.subscription;
    if (!subscriptionExternalId) {
      logger.warn({ invoiceId: data.id }, 'Invoice paid event has no subscription');
      return;
    }

    const subscription = await this.subscriptionRepo.findByExternalId(subscriptionExternalId);
    if (!subscription) {
      logger.warn({
        invoiceId: data.id,
        subscriptionExternalId,
      }, 'Subscription not found for invoice');
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

    // キャッシュ無効化
    await this.invalidateInvoiceCache(subscription.userId, subscription.organizationId);

    logger.info({
      invoiceNumber,
      subscriptionId: subscription.id,
    }, 'Invoice paid processed');
  }

  /**
   * 支払い失敗
   * Invoiceレコードを作成/更新（status=FAILED）、サブスクリプションをPAST_DUEに更新
   * トランザクションで一貫性を保証
   */
  private async handleInvoicePaymentFailed(data: StripeInvoiceData): Promise<void> {
    const subscriptionExternalId = data.subscription;
    if (!subscriptionExternalId) {
      logger.warn({ invoiceId: data.id }, 'Invoice payment failed event has no subscription');
      return;
    }

    const subscription = await this.subscriptionRepo.findByExternalId(subscriptionExternalId);
    if (!subscription) {
      logger.warn({
        invoiceId: data.id,
        subscriptionExternalId,
      }, 'Subscription not found for failed invoice');
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

    // キャッシュ無効化
    await this.invalidateInvoiceCache(subscription.userId, subscription.organizationId);

    logger.info({
      invoiceNumber,
      subscriptionId: subscription.id,
    }, 'Invoice payment failed processed');
  }

  /**
   * サブスクリプション作成
   * 通常はcreateSubscription時にDB書き込み済みのため、未登録時のみ作成
   * organizationIdがmetadataにある場合は組織向けサブスクリプションとして処理
   */
  private async handleSubscriptionCreated(data: StripeSubscriptionData): Promise<void> {
    const existing = await this.subscriptionRepo.findByExternalId(data.id);
    if (existing) {
      logger.info({
        externalId: data.id,
        subscriptionId: existing.id,
      }, 'Subscription already exists, skipping creation');
      return;
    }

    // metadataからユーザーIDまたは組織IDを取得
    const userId = data.metadata.userId;
    const organizationId = data.metadata.organizationId;

    if (!userId && !organizationId) {
      logger.warn({
        externalId: data.id,
      }, 'Subscription created event has no userId or organizationId in metadata');
      return;
    }

    const period = this.extractPeriod(data);
    if (!period) {
      logger.warn({ externalId: data.id }, 'Subscription has no period data');
      return;
    }

    const plan = this.mapPlan(data.metadata.plan);
    const billingCycle = this.mapBillingCycle(data.metadata.billingCycle);

    const subscriptionParams = {
      externalId: data.id,
      plan,
      billingCycle,
      currentPeriodStart: period.start,
      currentPeriodEnd: period.end,
      status: this.mapSubscriptionStatus(data.status),
      cancelAtPeriodEnd: data.cancel_at_period_end,
    };

    // 両方存在する場合は organizationId を優先（組織サブスクリプションが優先）
    if (organizationId) {
      // 組織向けサブスクリプション
      await this.subscriptionRepo.upsertForOrganization(organizationId, subscriptionParams);
      logger.info({
        externalId: data.id,
        organizationId,
        plan,
      }, 'Organization subscription created via webhook');
    } else if (userId) {
      // ユーザー向けサブスクリプション
      await this.subscriptionRepo.upsertForUser(userId, subscriptionParams);
      logger.info({
        externalId: data.id,
        userId,
        plan,
      }, 'Subscription created via webhook');
    }
  }

  /**
   * サブスクリプション更新
   * plan, billingCycle, status, currentPeriodStart/End, cancelAtPeriodEndをDB同期
   */
  private async handleSubscriptionUpdated(data: StripeSubscriptionData): Promise<void> {
    const subscription = await this.subscriptionRepo.findByExternalId(data.id);
    if (!subscription) {
      logger.warn({ externalId: data.id }, 'Subscription not found for update');
      return;
    }

    const period = this.extractPeriod(data);
    if (!period) {
      logger.warn({ externalId: data.id }, 'Subscription has no period data');
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

    logger.info({
      externalId: data.id,
      subscriptionId: subscription.id,
      status: data.status,
    }, 'Subscription updated via webhook');
  }

  /**
   * サブスクリプション削除
   * SubscriptionのstatusをCANCELEDに更新
   * ユーザー向け: User.planをFREEに更新
   * 組織向け: ステータス更新のみ（CANCELEDステータスで制御）
   */
  private async handleSubscriptionDeleted(data: StripeSubscriptionData): Promise<void> {
    const subscription = await this.subscriptionRepo.findByExternalId(data.id);
    if (!subscription) {
      logger.warn({ externalId: data.id }, 'Subscription not found for deletion');
      return;
    }

    // サブスクリプションのステータスをCANCELEDに更新
    await this.subscriptionRepo.update(subscription.id, {
      status: 'CANCELED',
    });

    // ユーザー向け: プランをFREEに更新
    if (subscription.userId) {
      await this.userRepo.updatePlan(subscription.userId, 'FREE');
      logger.info({
        externalId: data.id,
        subscriptionId: subscription.id,
        userId: subscription.userId,
      }, 'Subscription deleted via webhook (user)');
    }
    // 組織向け: ステータス更新のみ（CANCELEDステータスで制御）
    else if (subscription.organizationId) {
      logger.info({
        externalId: data.id,
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
      }, 'Subscription deleted via webhook (organization)');
    }
    // userId も organizationId もない場合は警告（通常発生しない）
    else {
      logger.warn({
        externalId: data.id,
        subscriptionId: subscription.id,
      }, 'Subscription deleted but has no userId or organizationId');
    }
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
   * 有料サブスクリプションのWebhookなのでFREEは対象外
   * 不明なプランの場合はログを残しPROにフォールバック
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
        // 有料サブスクリプションでmetadata.planが未設定または不明な場合
        // PROにフォールバック（個人向けデフォルトプラン）
        logger.warn({
          receivedPlan: plan,
        }, 'Unknown plan in metadata, defaulting to PRO');
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
        logger.warn({
          stripeStatus: status,
        }, 'Unknown subscription status, defaulting to ACTIVE');
        return 'ACTIVE';
    }
  }

  /**
   * Prismaのユニーク制約違反エラーかどうかを判定
   * 同時リクエストでexternalIdの重複が発生した場合の検出用
   */
  private isUniqueConstraintViolation(error: unknown): boolean {
    // Prismaのユニーク制約違反エラーコード: P2002
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return true;
    }
    return false;
  }

  /**
   * 請求履歴キャッシュを無効化
   * ユーザーまたは組織の請求履歴キャッシュを削除
   */
  private async invalidateInvoiceCache(
    userId: string | null,
    organizationId: string | null
  ): Promise<void> {
    try {
      if (userId) {
        await invalidateUserInvoicesCache(userId);
        logger.debug({ userId }, 'User invoice cache invalidated');
      }
      if (organizationId) {
        await invalidateOrgInvoicesCache(organizationId);
        logger.debug({ organizationId }, 'Organization invoice cache invalidated');
      }
    } catch (error) {
      // キャッシュ無効化の失敗はログのみ（処理は継続）
      logger.warn({
        userId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Failed to invalidate invoice cache');
    }
  }
}
