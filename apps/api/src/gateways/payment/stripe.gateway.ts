/**
 * Stripe決済ゲートウェイ実装
 * 本番環境で使用
 */

import Stripe from 'stripe';

import type { BillingCycle, PersonalPlan } from '@agentest/shared';

import { env } from '../../config/env.js';
import type { IPaymentGateway } from './payment-gateway.interface.js';
import type {
  CreateSubscriptionParams,
  Customer,
  InvoiceResult,
  PaymentMethodResult,
  PreviewProrationParams,
  ProrationPreview,
  SubscriptionResult,
  UpdateSubscriptionParams,
  WebhookEvent,
  WebhookEventType,
} from './types.js';

/**
 * Stripe決済ゲートウェイ
 */
export class StripeGateway implements IPaymentGateway {
  private stripe: Stripe;

  constructor() {
    const secretKey = env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required for StripeGateway');
    }
    this.stripe = new Stripe(secretKey);
  }

  // ============================================
  // 顧客管理
  // ============================================

  async createCustomer(
    email: string,
    metadata?: Record<string, string>
  ): Promise<Customer> {
    const customer = await this.stripe.customers.create({
      email,
      metadata,
    });
    return {
      id: customer.id,
      email: customer.email ?? email,
      createdAt: new Date(customer.created * 1000),
      metadata: (customer.metadata as Record<string, string>) ?? undefined,
    };
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customer = await this.stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        return null;
      }
      return {
        id: customer.id,
        email: customer.email ?? '',
        createdAt: new Date(customer.created * 1000),
        metadata: (customer.metadata as Record<string, string>) ?? undefined,
      };
    } catch {
      return null;
    }
  }

  // ============================================
  // 支払い方法管理
  // ============================================

  async attachPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<PaymentMethodResult> {
    const pm = await this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    return this.toPaymentMethodResult(pm, customerId);
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    await this.stripe.paymentMethods.detach(paymentMethodId);
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
    const methods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return methods.data.map((pm) => this.toPaymentMethodResult(pm, customerId));
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    await this.stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  // ============================================
  // サブスクリプション管理
  // ============================================

  async createSubscription(
    params: CreateSubscriptionParams
  ): Promise<SubscriptionResult> {
    const priceId = this.resolvePriceId(params.plan, params.billingCycle);

    const subscription = await this.stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: priceId }],
      default_payment_method: params.paymentMethodId,
      metadata: {
        plan: params.plan,
        billingCycle: params.billingCycle,
      },
    });

    return this.toSubscriptionResult(subscription);
  }

  async updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams
  ): Promise<SubscriptionResult> {
    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    const currentItemId = subscription.items.data[0]?.id;

    if (!currentItemId) {
      throw new Error('Subscription has no items');
    }

    const updateParams: Stripe.SubscriptionUpdateParams = {
      proration_behavior: 'create_prorations',
    };

    // プランまたは請求サイクルが変更された場合、Price IDを更新
    if (params.plan !== undefined || params.billingCycle !== undefined) {
      const plan = params.plan ?? (subscription.metadata.plan as PersonalPlan);
      const cycle = params.billingCycle ?? (subscription.metadata.billingCycle as BillingCycle);
      const newPriceId = this.resolvePriceId(plan, cycle);

      updateParams.items = [{ id: currentItemId, price: newPriceId }];
      updateParams.metadata = {
        plan,
        billingCycle: cycle,
      };
    }

    if (params.paymentMethodId) {
      updateParams.default_payment_method = params.paymentMethodId;
    }

    const updated = await this.stripe.subscriptions.update(subscriptionId, updateParams);
    return this.toSubscriptionResult(updated);
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean
  ): Promise<SubscriptionResult> {
    let subscription: Stripe.Subscription;

    if (cancelAtPeriodEnd) {
      // 期間終了時にキャンセル
      subscription = await this.stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    } else {
      // 即時キャンセル
      subscription = await this.stripe.subscriptions.cancel(subscriptionId);
    }

    return this.toSubscriptionResult(subscription);
  }

  async reactivateSubscription(
    subscriptionId: string
  ): Promise<SubscriptionResult> {
    // キャンセル予約を解除
    const subscription = await this.stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
    return this.toSubscriptionResult(subscription);
  }

  async getSubscription(
    subscriptionId: string
  ): Promise<SubscriptionResult | null> {
    try {
      const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
      return this.toSubscriptionResult(subscription);
    } catch {
      return null;
    }
  }

  // ============================================
  // 日割り計算
  // ============================================

  async previewProration(
    params: PreviewProrationParams
  ): Promise<ProrationPreview> {
    const subscription = await this.stripe.subscriptions.retrieve(params.subscriptionId);
    const currentItemId = subscription.items.data[0]?.id;

    if (!currentItemId) {
      throw new Error('Subscription has no items');
    }

    const newPriceId = this.resolvePriceId(params.newPlan, params.billingCycle);

    const invoice = await this.stripe.invoices.createPreview({
      customer: params.customerId,
      subscription: params.subscriptionId,
      subscription_details: {
        items: [{ id: currentItemId, price: newPriceId }],
        proration_date: Math.floor(Date.now() / 1000),
      },
    });

    // 日割り分のみ抽出（proration line items）
    const prorationAmount = invoice.lines.data
      .filter((line) =>
        line.parent?.invoice_item_details?.proration ||
        line.parent?.subscription_item_details?.proration
      )
      .reduce((sum, line) => sum + line.amount, 0);

    return {
      amountDue: Math.max(0, prorationAmount),
      currency: invoice.currency,
      effectiveDate: new Date(),
    };
  }

  // ============================================
  // 請求書
  // ============================================

  async getInvoice(invoiceId: string): Promise<InvoiceResult | null> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      return this.toInvoiceResult(invoice);
    } catch {
      return null;
    }
  }

  async listInvoices(customerId: string): Promise<InvoiceResult[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit: 100,
    });
    return invoices.data.map((inv) => this.toInvoiceResult(inv));
  }

  async getInvoicePdf(invoiceId: string): Promise<string | null> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId);
      return invoice.invoice_pdf ?? null;
    } catch {
      return null;
    }
  }

  // ============================================
  // Webhook
  // ============================================

  verifyWebhookSignature(payload: string, signature: string): boolean {
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is required');
    }
    try {
      this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
      return true;
    } catch {
      return false;
    }
  }

  parseWebhookEvent(payload: string): WebhookEvent {
    const event = JSON.parse(payload) as Stripe.Event;

    // StripeイベントタイプをWebhookEventTypeにマッピング
    const typeMap: Record<string, WebhookEventType> = {
      'invoice.paid': 'invoice.paid',
      'invoice.payment_failed': 'invoice.payment_failed',
      'customer.subscription.created': 'customer.subscription.created',
      'customer.subscription.updated': 'customer.subscription.updated',
      'customer.subscription.deleted': 'customer.subscription.deleted',
    };

    const mappedType = typeMap[event.type];
    if (!mappedType) {
      throw new Error(`Unsupported webhook event type: ${event.type}`);
    }

    return {
      id: event.id,
      type: mappedType,
      data: {
        object: event.data.object,
      },
      createdAt: new Date(event.created * 1000),
    };
  }

  // ============================================
  // ユーティリティ（private）
  // ============================================

  /**
   * プランと請求サイクルからStripe Price IDを解決
   */
  private resolvePriceId(plan: PersonalPlan, cycle: BillingCycle): string {
    if (plan === 'FREE') {
      throw new Error('FREE plan does not have a Stripe Price ID');
    }

    if (cycle === 'MONTHLY') {
      const priceId = env.STRIPE_PRICE_PRO_MONTHLY;
      if (!priceId) {
        throw new Error('STRIPE_PRICE_PRO_MONTHLY is not configured');
      }
      return priceId;
    }

    const priceId = env.STRIPE_PRICE_PRO_YEARLY;
    if (!priceId) {
      throw new Error('STRIPE_PRICE_PRO_YEARLY is not configured');
    }
    return priceId;
  }

  /**
   * Stripe PaymentMethodを内部型に変換
   */
  private toPaymentMethodResult(
    pm: Stripe.PaymentMethod,
    customerId: string
  ): PaymentMethodResult {
    return {
      id: pm.id,
      customerId,
      brand: pm.card?.brand ?? 'unknown',
      last4: pm.card?.last4 ?? '0000',
      expiryMonth: pm.card?.exp_month ?? 0,
      expiryYear: pm.card?.exp_year ?? 0,
    };
  }

  /**
   * Stripe Subscriptionを内部型に変換
   */
  private toSubscriptionResult(sub: Stripe.Subscription): SubscriptionResult {
    const statusMap: Record<string, SubscriptionResult['status']> = {
      active: 'active',
      past_due: 'past_due',
      canceled: 'canceled',
      trialing: 'trialing',
      incomplete: 'incomplete',
      incomplete_expired: 'incomplete_expired',
    };

    return {
      id: sub.id,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      status: statusMap[sub.status] ?? 'incomplete',
      plan: (sub.metadata.plan as PersonalPlan) ?? 'PRO',
      billingCycle: (sub.metadata.billingCycle as BillingCycle) ?? 'MONTHLY',
      currentPeriodStart: new Date((sub.items.data[0]?.current_period_start ?? 0) * 1000),
      currentPeriodEnd: new Date((sub.items.data[0]?.current_period_end ?? 0) * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  }

  /**
   * Stripe Invoiceを内部型に変換
   */
  private toInvoiceResult(inv: Stripe.Invoice): InvoiceResult {
    const statusMap: Record<string, InvoiceResult['status']> = {
      draft: 'draft',
      open: 'open',
      paid: 'paid',
      uncollectible: 'uncollectible',
      void: 'void',
    };

    return {
      id: inv.id,
      subscriptionId: (() => {
        const sub = inv.parent?.subscription_details?.subscription;
        if (!sub) return '';
        return typeof sub === 'string' ? sub : sub.id;
      })(),
      customerId: typeof inv.customer === 'string'
        ? inv.customer
        : inv.customer?.id ?? '',
      invoiceNumber: inv.number ?? '',
      amount: inv.amount_due,
      currency: inv.currency,
      status: statusMap[inv.status ?? ''] ?? 'draft',
      periodStart: new Date((inv.period_start ?? 0) * 1000),
      periodEnd: new Date((inv.period_end ?? 0) * 1000),
      dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
      pdfUrl: inv.invoice_pdf ?? null,
      createdAt: new Date(inv.created * 1000),
    };
  }
}
