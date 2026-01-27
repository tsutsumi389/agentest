/**
 * 決済ゲートウェイ共通型定義
 *
 * 注: PersonalPlan ('FREE' | 'PRO') は個人ユーザー向けプランを表す。
 * DBスキーマの SubscriptionPlan (FREE/PRO/TEAM/ENTERPRISE) とは異なり、
 * このモジュールは個人プランのみを扱う。
 * 組織プラン (TEAM/ENTERPRISE) は別途実装予定。
 */

import type { BillingCycle, PersonalPlan } from '@agentest/shared';

/**
 * 顧客情報
 */
export interface Customer {
  id: string;
  email: string;
  createdAt: Date;
  metadata?: Record<string, string>;
}

/**
 * 支払い方法
 */
export interface PaymentMethodResult {
  id: string;
  customerId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

/**
 * サブスクリプション作成パラメータ
 */
export interface CreateSubscriptionParams {
  customerId: string;
  plan: PersonalPlan;
  billingCycle: BillingCycle;
  paymentMethodId: string;
}

/**
 * サブスクリプション更新パラメータ
 */
export interface UpdateSubscriptionParams {
  plan?: PersonalPlan;
  billingCycle?: BillingCycle;
  paymentMethodId?: string;
}

/**
 * サブスクリプション結果
 */
export interface SubscriptionResult {
  id: string;
  customerId: string;
  status:
    | 'active'
    | 'past_due'
    | 'canceled'
    | 'paused'
    | 'trialing'
    | 'incomplete'
    | 'incomplete_expired';
  plan: PersonalPlan;
  billingCycle: BillingCycle;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

/**
 * 日割り計算プレビューパラメータ
 */
export interface PreviewProrationParams {
  customerId: string;
  subscriptionId: string;
  currentPlan: PersonalPlan;
  newPlan: PersonalPlan;
  billingCycle: BillingCycle;
}

/**
 * 日割り計算プレビュー結果
 */
export interface ProrationPreview {
  amountDue: number;
  currency: string;
  effectiveDate: Date;
}

/**
 * 請求書
 */
export interface InvoiceResult {
  id: string;
  subscriptionId: string;
  customerId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date | null;
  pdfUrl: string | null;
  createdAt: Date;
}

/**
 * Webhookイベント型
 */
export type WebhookEventType =
  | 'invoice.paid'
  | 'invoice.payment_failed'
  | 'customer.subscription.created'
  | 'customer.subscription.updated'
  | 'customer.subscription.deleted';

/**
 * Webhookイベント
 */
export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: {
    object: unknown;
  };
  createdAt: Date;
}
