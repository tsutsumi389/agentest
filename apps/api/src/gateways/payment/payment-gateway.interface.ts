/**
 * 決済ゲートウェイインターフェース
 * Stripe/Mock実装で共通のインターフェースを定義
 */

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

export interface IPaymentGateway {
  // ============================================
  // 顧客管理
  // ============================================

  /**
   * 顧客を作成
   */
  createCustomer(
    email: string,
    metadata?: Record<string, string>
  ): Promise<Customer>;

  /**
   * 顧客を取得
   */
  getCustomer(customerId: string): Promise<Customer | null>;

  // ============================================
  // 支払い方法管理
  // ============================================

  /**
   * 支払い方法を紐付け
   */
  attachPaymentMethod(
    customerId: string,
    token: string
  ): Promise<PaymentMethodResult>;

  /**
   * 支払い方法を削除
   */
  detachPaymentMethod(paymentMethodId: string): Promise<void>;

  /**
   * 支払い方法一覧を取得
   */
  listPaymentMethods(customerId: string): Promise<PaymentMethodResult[]>;

  /**
   * デフォルト支払い方法を設定
   */
  setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void>;

  // ============================================
  // サブスクリプション管理
  // ============================================

  /**
   * サブスクリプションを作成
   */
  createSubscription(
    params: CreateSubscriptionParams
  ): Promise<SubscriptionResult>;

  /**
   * サブスクリプションを更新
   */
  updateSubscription(
    subscriptionId: string,
    params: UpdateSubscriptionParams
  ): Promise<SubscriptionResult>;

  /**
   * サブスクリプションをキャンセル
   */
  cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean
  ): Promise<SubscriptionResult>;

  /**
   * サブスクリプションを再開（キャンセル予約を解除）
   */
  reactivateSubscription(subscriptionId: string): Promise<SubscriptionResult>;

  /**
   * サブスクリプションを取得
   */
  getSubscription(subscriptionId: string): Promise<SubscriptionResult | null>;

  // ============================================
  // 日割り計算
  // ============================================

  /**
   * プラン変更時の日割り計算プレビュー
   */
  previewProration(params: PreviewProrationParams): Promise<ProrationPreview>;

  // ============================================
  // 請求書
  // ============================================

  /**
   * 請求書を取得
   */
  getInvoice(invoiceId: string): Promise<InvoiceResult | null>;

  /**
   * 請求書一覧を取得
   */
  listInvoices(customerId: string): Promise<InvoiceResult[]>;

  /**
   * 請求書PDFのURLを取得
   */
  getInvoicePdf(invoiceId: string): Promise<string | null>;

  // ============================================
  // Webhook
  // ============================================

  /**
   * Webhook署名を検証し、検証済みイベントをパースして返す
   * 署名検証とパースを統合することで、検証済みペイロードのみが使用されることを保証する
   */
  verifyAndParseWebhookEvent(payload: string, signature: string): WebhookEvent;
}
