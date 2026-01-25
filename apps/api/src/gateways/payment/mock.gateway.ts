/**
 * モック決済ゲートウェイ実装
 * 開発・テスト環境で使用
 */

import { randomUUID } from 'crypto';

import { PERSONAL_PLAN_PRICING, type BillingCycle } from '@agentest/shared';

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
 * インメモリストアの型定義
 */
interface MockStore {
  customers: Map<string, Customer>;
  paymentMethods: Map<string, PaymentMethodResult>;
  customerPaymentMethods: Map<string, string[]>;
  defaultPaymentMethods: Map<string, string>;
  subscriptions: Map<string, SubscriptionResult>;
  invoices: Map<string, InvoiceResult>;
}

/**
 * モック決済ゲートウェイ
 */
export class MockGateway implements IPaymentGateway {
  private store: MockStore = {
    customers: new Map(),
    paymentMethods: new Map(),
    customerPaymentMethods: new Map(),
    defaultPaymentMethods: new Map(),
    subscriptions: new Map(),
    invoices: new Map(),
  };

  // ============================================
  // 顧客管理
  // ============================================

  async createCustomer(
    email: string,
    metadata?: Record<string, string>
  ): Promise<Customer> {
    const id = `cus_mock_${randomUUID().slice(0, 8)}`;
    const customer: Customer = {
      id,
      email,
      createdAt: new Date(),
      metadata,
    };
    this.store.customers.set(id, customer);
    this.store.customerPaymentMethods.set(id, []);
    return customer;
  }

  async getCustomer(customerId: string): Promise<Customer | null> {
    return this.store.customers.get(customerId) ?? null;
  }

  // ============================================
  // 支払い方法管理
  // ============================================

  async attachPaymentMethod(
    customerId: string,
    token: string
  ): Promise<PaymentMethodResult> {
    // トークンを無視し、テストカード情報を返却
    const id = `pm_mock_${randomUUID().slice(0, 8)}`;
    const result: PaymentMethodResult = {
      id,
      customerId,
      brand: 'visa',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2030,
    };
    this.store.paymentMethods.set(id, result);

    // 顧客に紐付け
    const methods = this.store.customerPaymentMethods.get(customerId) ?? [];
    methods.push(id);
    this.store.customerPaymentMethods.set(customerId, methods);

    // 初めての支払い方法の場合はデフォルトに設定
    if (methods.length === 1) {
      this.store.defaultPaymentMethods.set(customerId, id);
    }

    // テスト用にトークンに基づいて異なるカード情報を返す
    if (token.includes('mastercard')) {
      result.brand = 'mastercard';
      result.last4 = '5555';
    } else if (token.includes('amex')) {
      result.brand = 'amex';
      result.last4 = '0005';
    }

    return result;
  }

  async detachPaymentMethod(paymentMethodId: string): Promise<void> {
    const method = this.store.paymentMethods.get(paymentMethodId);
    if (!method) {
      return;
    }

    // 顧客からの紐付けを解除
    const methods = this.store.customerPaymentMethods.get(method.customerId);
    if (methods) {
      const index = methods.indexOf(paymentMethodId);
      if (index > -1) {
        methods.splice(index, 1);
      }
      this.store.customerPaymentMethods.set(method.customerId, methods);
    }

    // デフォルト設定を解除
    const defaultMethod = this.store.defaultPaymentMethods.get(
      method.customerId
    );
    if (defaultMethod === paymentMethodId) {
      this.store.defaultPaymentMethods.delete(method.customerId);
    }

    this.store.paymentMethods.delete(paymentMethodId);
  }

  async listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]> {
    const methodIds = this.store.customerPaymentMethods.get(customerId) ?? [];
    return methodIds
      .map((id) => this.store.paymentMethods.get(id))
      .filter((m): m is PaymentMethodResult => m !== undefined);
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    const method = this.store.paymentMethods.get(paymentMethodId);
    if (!method || method.customerId !== customerId) {
      throw new Error('Payment method not found or does not belong to customer');
    }
    this.store.defaultPaymentMethods.set(customerId, paymentMethodId);
  }

  // ============================================
  // サブスクリプション管理
  // ============================================

  async createSubscription(
    params: CreateSubscriptionParams
  ): Promise<SubscriptionResult> {
    const id = `sub_mock_${randomUUID().slice(0, 8)}`;
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, params.billingCycle);

    const result: SubscriptionResult = {
      id,
      customerId: params.customerId,
      status: 'active',
      plan: params.plan,
      billingCycle: params.billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
    };
    this.store.subscriptions.set(id, result);

    // 請求書を作成
    this.createMockInvoice(id, params.customerId, params.plan, params.billingCycle);

    return result;
  }

  async updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams
  ): Promise<SubscriptionResult> {
    const subscription = this.store.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (params.plan !== undefined) {
      subscription.plan = params.plan;
    }
    if (params.billingCycle !== undefined) {
      subscription.billingCycle = params.billingCycle;
    }

    this.store.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean
  ): Promise<SubscriptionResult> {
    const subscription = this.store.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    if (cancelAtPeriodEnd) {
      // 期間終了時にキャンセル
      subscription.cancelAtPeriodEnd = true;
    } else {
      // 即時キャンセル
      subscription.status = 'canceled';
    }

    this.store.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async reactivateSubscription(
    subscriptionId: string
  ): Promise<SubscriptionResult> {
    const subscription = this.store.subscriptions.get(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    subscription.cancelAtPeriodEnd = false;
    this.store.subscriptions.set(subscriptionId, subscription);
    return subscription;
  }

  async getSubscription(
    subscriptionId: string
  ): Promise<SubscriptionResult | null> {
    return this.store.subscriptions.get(subscriptionId) ?? null;
  }

  // ============================================
  // 日割り計算
  // ============================================

  async previewProration(
    params: PreviewProrationParams
  ): Promise<ProrationPreview> {
    const subscription = this.store.subscriptions.get(params.subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // 残り日数の計算
    const now = new Date();
    const periodEnd = subscription.currentPeriodEnd;
    const totalDays = this.getDaysBetween(
      subscription.currentPeriodStart,
      periodEnd
    );
    const remainingDays = Math.max(0, this.getDaysBetween(now, periodEnd));
    const prorationFactor = totalDays > 0 ? remainingDays / totalDays : 0;

    // 料金計算
    const oldAmount = this.getPlanPrice(params.currentPlan, params.billingCycle);
    const newAmount = this.getPlanPrice(params.newPlan, params.billingCycle);
    const amountDue = Math.round((newAmount - oldAmount) * prorationFactor);

    return {
      amountDue: Math.max(0, amountDue),
      currency: 'jpy',
      effectiveDate: now,
    };
  }

  // ============================================
  // 請求書
  // ============================================

  async getInvoice(invoiceId: string): Promise<InvoiceResult | null> {
    return this.store.invoices.get(invoiceId) ?? null;
  }

  async listInvoices(customerId: string): Promise<InvoiceResult[]> {
    const invoices: InvoiceResult[] = [];
    for (const invoice of this.store.invoices.values()) {
      if (invoice.customerId === customerId) {
        invoices.push(invoice);
      }
    }
    return invoices.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getInvoicePdf(invoiceId: string): Promise<string | null> {
    const invoice = this.store.invoices.get(invoiceId);
    return invoice?.pdfUrl ?? null;
  }

  // ============================================
  // Webhook（モックでは不要だが実装）
  // ============================================

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    // モックでは常に検証成功
    return true;
  }

  parseWebhookEvent(payload: string): WebhookEvent {
    return JSON.parse(payload) as WebhookEvent;
  }

  // ============================================
  // ユーティリティ
  // ============================================

  /**
   * プラン価格を取得
   */
  private getPlanPrice(plan: 'FREE' | 'PRO', cycle: BillingCycle): number {
    const pricing = PERSONAL_PLAN_PRICING[plan];
    return cycle === 'YEARLY' ? pricing.yearlyPrice : pricing.monthlyPrice;
  }

  /**
   * 期間終了日を計算
   */
  private calculatePeriodEnd(startDate: Date, cycle: BillingCycle): Date {
    const endDate = new Date(startDate);
    if (cycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
  }

  /**
   * 2つの日付間の日数を計算
   */
  private getDaysBetween(start: Date, end: Date): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((end.getTime() - start.getTime()) / msPerDay);
  }

  /**
   * モック請求書を作成
   */
  private createMockInvoice(
    subscriptionId: string,
    customerId: string,
    plan: 'FREE' | 'PRO',
    cycle: BillingCycle
  ): void {
    const id = `inv_mock_${randomUUID().slice(0, 8)}`;
    const now = new Date();
    const periodEnd = this.calculatePeriodEnd(now, cycle);
    const amount = this.getPlanPrice(plan, cycle);

    const invoice: InvoiceResult = {
      id,
      subscriptionId,
      customerId,
      invoiceNumber: `INV-${Date.now()}`,
      amount,
      currency: 'jpy',
      status: 'paid',
      periodStart: now,
      periodEnd,
      dueDate: now,
      pdfUrl: null,
      createdAt: now,
    };
    this.store.invoices.set(id, invoice);
  }

  // ============================================
  // テスト用メソッド
  // ============================================

  /**
   * ストアをリセット（テスト用）
   */
  reset(): void {
    this.store = {
      customers: new Map(),
      paymentMethods: new Map(),
      customerPaymentMethods: new Map(),
      defaultPaymentMethods: new Map(),
      subscriptions: new Map(),
      invoices: new Map(),
    };
  }
}
