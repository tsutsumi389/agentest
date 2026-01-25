/**
 * Stripe決済ゲートウェイ実装
 * 本番環境で使用（Stripeアカウント作成後に実装）
 *
 * TODO: Stripeアカウント作成後に以下を実装
 * - 環境変数: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
 * - stripe パッケージのインストール
 */

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
} from './types.js';

/**
 * Stripe決済ゲートウェイ
 * 現在はスケルトン実装。Stripeアカウント作成後に完全実装する。
 */
export class StripeGateway implements IPaymentGateway {
  // private stripe: Stripe;

  constructor() {
    // const secretKey = process.env.STRIPE_SECRET_KEY;
    // if (!secretKey) {
    //   throw new Error('STRIPE_SECRET_KEY is required');
    // }
    // this.stripe = new Stripe(secretKey);
  }

  // ============================================
  // 顧客管理
  // ============================================

  async createCustomer(
    _email: string,
    _metadata?: Record<string, string>
  ): Promise<Customer> {
    // TODO: Stripe実装
    // const customer = await this.stripe.customers.create({
    //   email,
    //   metadata,
    // });
    // return {
    //   id: customer.id,
    //   email: customer.email ?? email,
    //   createdAt: new Date(customer.created * 1000),
    //   metadata: customer.metadata as Record<string, string>,
    // };
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async getCustomer(_customerId: string): Promise<Customer | null> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  // ============================================
  // 支払い方法管理
  // ============================================

  async attachPaymentMethod(
    _customerId: string,
    _token: string
  ): Promise<PaymentMethodResult> {
    // TODO: Stripe実装
    // const paymentMethod = await this.stripe.paymentMethods.attach(token, {
    //   customer: customerId,
    // });
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async detachPaymentMethod(_paymentMethodId: string): Promise<void> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async listPaymentMethods(_customerId: string): Promise<PaymentMethodResult[]> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async setDefaultPaymentMethod(
    _customerId: string,
    _paymentMethodId: string
  ): Promise<void> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  // ============================================
  // サブスクリプション管理
  // ============================================

  async createSubscription(
    _params: CreateSubscriptionParams
  ): Promise<SubscriptionResult> {
    // TODO: Stripe実装
    // const subscription = await this.stripe.subscriptions.create({
    //   customer: params.customerId,
    //   items: [{ price: params.priceId }],
    //   default_payment_method: params.paymentMethodId,
    // });
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async updateSubscription(
    _subscriptionId: string,
    _params: UpdateSubscriptionParams
  ): Promise<SubscriptionResult> {
    // TODO: Stripe実装
    // const subscription = await this.stripe.subscriptions.update(subscriptionId, {
    //   items: [{ id: itemId, price: params.priceId }],
    //   proration_behavior: 'create_prorations',
    // });
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async cancelSubscription(
    _subscriptionId: string,
    _cancelAtPeriodEnd: boolean
  ): Promise<SubscriptionResult> {
    // TODO: Stripe実装
    // const subscription = await this.stripe.subscriptions.update(subscriptionId, {
    //   cancel_at_period_end: cancelAtPeriodEnd,
    // });
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async reactivateSubscription(
    _subscriptionId: string
  ): Promise<SubscriptionResult> {
    // TODO: Stripe実装
    // const subscription = await this.stripe.subscriptions.update(subscriptionId, {
    //   cancel_at_period_end: false,
    // });
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async getSubscription(
    _subscriptionId: string
  ): Promise<SubscriptionResult | null> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  // ============================================
  // 日割り計算
  // ============================================

  async previewProration(
    _params: PreviewProrationParams
  ): Promise<ProrationPreview> {
    // TODO: Stripe Upcoming Invoice APIを使用
    // const invoice = await this.stripe.invoices.retrieveUpcoming({
    //   customer: params.customerId,
    //   subscription: params.subscriptionId,
    //   subscription_items: [{ id: itemId, price: params.newPriceId }],
    // });
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  // ============================================
  // 請求書
  // ============================================

  async getInvoice(_invoiceId: string): Promise<InvoiceResult | null> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async listInvoices(_customerId: string): Promise<InvoiceResult[]> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  async getInvoicePdf(_invoiceId: string): Promise<string | null> {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  // ============================================
  // Webhook
  // ============================================

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    // TODO: Stripe実装
    // const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // try {
    //   this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    //   return true;
    // } catch {
    //   return false;
    // }
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }

  parseWebhookEvent(_payload: string): WebhookEvent {
    // TODO: Stripe実装
    throw new Error('StripeGateway not implemented. Use MockGateway instead.');
  }
}
