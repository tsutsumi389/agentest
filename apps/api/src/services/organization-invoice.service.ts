/**
 * 組織向け請求書サービス
 * 組織の請求書取得を担当
 */

import {
  InvoiceRepository,
  type PaginatedResult,
  type PaginationParams,
} from '../repositories/invoice.repository.js';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import type { Invoice } from '@agentest/db';

/**
 * 請求書レスポンス
 */
export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  pdfUrl: string | null;
  createdAt: Date;
}

/**
 * 組織向け請求書サービス
 */
export class OrganizationInvoiceService {
  private invoiceRepo = new InvoiceRepository();
  private subscriptionRepo = new SubscriptionRepository();

  /**
   * 組織の請求書一覧を取得
   * サブスクリプションがない場合は空の結果を返す
   */
  async getInvoices(
    orgId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResult<InvoiceResponse>> {
    // 組織のサブスクリプションを取得
    const subscription =
      await this.subscriptionRepo.findByOrganizationId(orgId);

    // サブスクリプションがない場合は空の結果を返す
    if (!subscription) {
      return {
        data: [],
        total: 0,
        page: pagination.page,
        limit: pagination.limit,
        totalPages: 0,
      };
    }

    // サブスクリプションIDで請求書を取得
    const result = await this.invoiceRepo.findBySubscriptionId(
      subscription.id,
      pagination
    );

    return {
      data: result.data.map(this.toResponse),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Invoiceエンティティをレスポンス形式に変換
   */
  private toResponse(invoice: Invoice): InvoiceResponse {
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
