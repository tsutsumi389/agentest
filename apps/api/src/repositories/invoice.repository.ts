/**
 * 請求書リポジトリ
 */

import { prisma, type Invoice, type Prisma } from '@agentest/db';

/**
 * 請求書アップサートパラメータ
 */
export interface UpsertInvoiceParams {
  subscriptionId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'VOID';
  periodStart: Date;
  periodEnd: Date;
  dueDate: Date;
  pdfUrl?: string | null;
}

/**
 * 請求書リポジトリ
 */
export class InvoiceRepository {
  /**
   * 請求書番号で請求書を取得
   */
  async findByInvoiceNumber(invoiceNumber: string): Promise<Invoice | null> {
    return prisma.invoice.findUnique({
      where: { invoiceNumber },
    });
  }

  /**
   * 請求書番号でアップサート（存在すれば更新、なければ作成）
   */
  async upsertByInvoiceNumber(
    invoiceNumber: string,
    data: UpsertInvoiceParams
  ): Promise<Invoice> {
    const createData: Prisma.InvoiceCreateInput = {
      subscription: { connect: { id: data.subscriptionId } },
      invoiceNumber: data.invoiceNumber,
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      dueDate: data.dueDate,
      pdfUrl: data.pdfUrl ?? null,
    };

    const updateData: Prisma.InvoiceUpdateInput = {
      amount: data.amount,
      currency: data.currency,
      status: data.status,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      dueDate: data.dueDate,
      pdfUrl: data.pdfUrl ?? null,
    };

    return prisma.invoice.upsert({
      where: { invoiceNumber },
      create: createData,
      update: updateData,
    });
  }
}
