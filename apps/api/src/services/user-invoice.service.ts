/**
 * ユーザー請求履歴サービス
 * 個人ユーザーの請求履歴取得を担当
 * Stripe APIからデータを取得し、Redisでキャッシュ
 */

import { prisma } from '@agentest/db';
import { NotFoundError, AuthorizationError } from '@agentest/shared';
import { getPaymentGateway } from '../gateways/payment/index.js';
import type { IPaymentGateway } from '../gateways/payment/payment-gateway.interface.js';
import type { InvoiceResult } from '../gateways/payment/types.js';
import {
  getUserInvoicesCache,
  setUserInvoicesCache,
  invalidateUserInvoicesCache,
} from '../lib/redis-store.js';
import { logger } from '../utils/logger.js';

/**
 * 請求履歴レスポンス
 */
export interface InvoiceResponse {
  id: string;
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
 * 請求履歴一覧レスポンス
 */
export interface InvoiceListResponse {
  invoices: InvoiceResponse[];
  total: number;
}

/**
 * ユーザー請求履歴サービス
 */
export class UserInvoiceService {
  private paymentGateway: IPaymentGateway;

  constructor(paymentGateway?: IPaymentGateway) {
    this.paymentGateway = paymentGateway ?? getPaymentGateway();
  }

  /**
   * ユーザーの請求履歴一覧を取得
   * Redisキャッシュを使用（TTL: 5分）
   */
  async getInvoices(userId: string): Promise<InvoiceListResponse> {
    // キャッシュチェック
    const cached = await getUserInvoicesCache<InvoiceListResponse>(userId);
    if (cached) {
      logger.debug({ userId }, 'Invoice cache hit');
      return cached;
    }

    // ユーザーの決済顧客IDを取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { paymentCustomerId: true },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // 決済顧客IDがない場合は空のリストを返す
    if (!user.paymentCustomerId) {
      const emptyResult: InvoiceListResponse = { invoices: [], total: 0 };
      await setUserInvoicesCache(userId, emptyResult);
      return emptyResult;
    }

    // Stripe APIから請求履歴を取得
    const stripeInvoices = await this.paymentGateway.listInvoices(
      user.paymentCustomerId
    );

    const invoices = stripeInvoices.map((inv) => this.toResponse(inv));
    const result: InvoiceListResponse = {
      invoices,
      total: invoices.length,
    };

    // キャッシュに保存（5分）
    await setUserInvoicesCache(userId, result);

    logger.debug({
      userId,
      count: invoices.length,
    }, 'Invoice cache miss, fetched from Stripe');

    return result;
  }

  /**
   * 請求書詳細を取得
   */
  async getInvoice(userId: string, invoiceId: string): Promise<InvoiceResponse> {
    const invoice = await this.getInvoiceWithAuth(userId, invoiceId);
    return this.toResponse(invoice);
  }

  /**
   * 請求書PDFのURLを取得
   * StripeのPDFリンクにリダイレクトするためのURL取得
   */
  async getInvoicePdfUrl(userId: string, invoiceId: string): Promise<string> {
    // 認可チェック済みの請求書を取得
    await this.getInvoiceWithAuth(userId, invoiceId);

    // PDF URLを取得
    const pdfUrl = await this.paymentGateway.getInvoicePdf(invoiceId);

    if (!pdfUrl) {
      throw new NotFoundError('InvoicePdf', invoiceId);
    }

    return pdfUrl;
  }

  /**
   * 請求履歴キャッシュを無効化
   * Webhook処理などから呼び出される
   */
  async invalidateCache(userId: string): Promise<void> {
    await invalidateUserInvoicesCache(userId);
    logger.debug({ userId }, 'Invoice cache invalidated');
  }

  /**
   * 認可チェック付きで請求書を取得
   * ユーザーの決済顧客IDと請求書の顧客IDが一致するか確認
   */
  private async getInvoiceWithAuth(
    userId: string,
    invoiceId: string
  ): Promise<InvoiceResult> {
    // ユーザーの決済顧客IDを取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { paymentCustomerId: true },
    });

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (!user.paymentCustomerId) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    // Stripe APIから請求書を取得
    const invoice = await this.paymentGateway.getInvoice(invoiceId);

    if (!invoice) {
      throw new NotFoundError('Invoice', invoiceId);
    }

    // 請求書の顧客IDが一致するか確認（認可チェック）
    if (invoice.customerId !== user.paymentCustomerId) {
      throw new AuthorizationError('この請求書にアクセスする権限がありません');
    }

    return invoice;
  }

  /**
   * InvoiceResultをレスポンス形式に変換
   */
  private toResponse(invoice: InvoiceResult): InvoiceResponse {
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      currency: invoice.currency,
      status: invoice.status,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      dueDate: invoice.dueDate,
      pdfUrl: invoice.pdfUrl,
      createdAt: invoice.createdAt,
    };
  }
}
