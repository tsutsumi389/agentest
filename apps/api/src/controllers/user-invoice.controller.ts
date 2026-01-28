/**
 * ユーザー請求履歴コントローラー
 * 個人ユーザーの請求履歴APIを提供
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthorizationError } from '@agentest/shared';
import { UserInvoiceService } from '../services/user-invoice.service.js';

/**
 * 請求書IDパラメータスキーマ
 */
const invoiceIdSchema = z.object({
  invoiceId: z.string().min(1),
});

/**
 * ユーザー請求履歴コントローラー
 */
export class UserInvoiceController {
  private userInvoiceService = new UserInvoiceService();

  /**
   * 請求履歴一覧取得
   * GET /api/users/:userId/invoices
   *
   * 認可: 自分自身のデータのみアクセス可能
   */
  getInvoices = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // 認可チェック: 自分自身のデータのみアクセス可能
      // requireOwnershipミドルウェアで既にチェック済みだが、念のため二重チェック
      if (req.user?.id !== userId) {
        throw new AuthorizationError('他のユーザーの請求履歴にはアクセスできません');
      }

      const result = await this.userInvoiceService.getInvoices(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * 請求書詳細取得
   * GET /api/users/:userId/invoices/:invoiceId
   *
   * 認可: 自分自身のデータのみアクセス可能
   */
  getInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const { invoiceId } = invoiceIdSchema.parse(req.params);

      // 認可チェック
      if (req.user?.id !== userId) {
        throw new AuthorizationError('他のユーザーの請求履歴にはアクセスできません');
      }

      const invoice = await this.userInvoiceService.getInvoice(userId, invoiceId);
      res.json({ invoice });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 請求書PDFダウンロード
   * GET /api/users/:userId/invoices/:invoiceId/pdf
   *
   * StripeのPDFリンクにリダイレクト
   * 認可: 自分自身のデータのみアクセス可能
   */
  getInvoicePdf = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const { invoiceId } = invoiceIdSchema.parse(req.params);

      // 認可チェック
      if (req.user?.id !== userId) {
        throw new AuthorizationError('他のユーザーの請求履歴にはアクセスできません');
      }

      const pdfUrl = await this.userInvoiceService.getInvoicePdfUrl(
        userId,
        invoiceId
      );

      // StripeのPDF URLにリダイレクト
      res.redirect(pdfUrl);
    } catch (error) {
      next(error);
    }
  };
}
