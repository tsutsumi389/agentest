/**
 * 組織向けBillingコントローラー
 * 組織のサブスクリプション、支払い方法、請求書を管理するAPI
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OrganizationSubscriptionService } from '../services/organization-subscription.service.js';
import { OrganizationPaymentMethodService } from '../services/organization-payment-method.service.js';
import { OrganizationInvoiceService } from '../services/organization-invoice.service.js';

/**
 * サブスクリプション作成スキーマ
 */
const createSubscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  paymentMethodId: z.string().uuid(),
});

/**
 * サブスクリプション更新スキーマ
 */
const updateSubscriptionSchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

/**
 * 支払い方法追加スキーマ
 */
const addPaymentMethodSchema = z.object({
  token: z.string().min(1, 'トークンは必須です'),
});

/**
 * ページネーションスキーマ
 */
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * 料金計算クエリスキーマ
 */
const calculateQuerySchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

/**
 * 組織向けBillingコントローラー
 */
export class OrganizationBillingController {
  private subscriptionService = new OrganizationSubscriptionService();
  private paymentMethodService = new OrganizationPaymentMethodService();
  private invoiceService = new OrganizationInvoiceService();

  // ====================================================================
  // Subscription
  // ====================================================================

  /**
   * サブスクリプション取得
   * GET /api/organizations/:organizationId/subscription
   */
  getSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const subscription =
        await this.subscriptionService.getSubscription(organizationId);
      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * サブスクリプション作成（TEAM契約開始）
   * POST /api/organizations/:organizationId/subscription
   */
  createSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const input = createSubscriptionSchema.parse(req.body);
      const subscription = await this.subscriptionService.createSubscription(
        organizationId,
        {
          plan: 'TEAM',
          billingCycle: input.billingCycle,
          paymentMethodId: input.paymentMethodId,
        }
      );
      res.status(201).json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * サブスクリプション更新（請求サイクル変更）
   * PUT /api/organizations/:organizationId/subscription
   */
  updateSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const input = updateSubscriptionSchema.parse(req.body);
      const subscription = await this.subscriptionService.updateSubscription(
        organizationId,
        input
      );
      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * サブスクリプションキャンセル（期間終了時にキャンセル予約）
   * DELETE /api/organizations/:organizationId/subscription
   */
  cancelSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const subscription =
        await this.subscriptionService.cancelSubscription(organizationId);
      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * キャンセル予約を解除（サブスクリプション継続）
   * POST /api/organizations/:organizationId/subscription/reactivate
   */
  reactivateSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const subscription =
        await this.subscriptionService.reactivateSubscription(organizationId);
      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * プラン変更時の料金計算
   * GET /api/organizations/:organizationId/subscription/calculate
   */
  calculatePlanChange = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const { billingCycle } = calculateQuerySchema.parse(req.query);
      const calculation = await this.subscriptionService.calculatePlanChange(
        organizationId,
        'TEAM', // 現在TEAMのみ対応
        billingCycle
      );
      res.json({ calculation });
    } catch (error) {
      next(error);
    }
  };

  // ====================================================================
  // Payment Methods
  // ====================================================================

  /**
   * 支払い方法一覧取得
   * GET /api/organizations/:organizationId/payment-methods
   */
  getPaymentMethods = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const paymentMethods =
        await this.paymentMethodService.getPaymentMethods(organizationId);
      res.json({ paymentMethods });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 支払い方法追加
   * POST /api/organizations/:organizationId/payment-methods
   */
  addPaymentMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const { token } = addPaymentMethodSchema.parse(req.body);
      const paymentMethod = await this.paymentMethodService.addPaymentMethod(
        organizationId,
        token
      );
      res.status(201).json({ paymentMethod });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 支払い方法削除
   * DELETE /api/organizations/:organizationId/payment-methods/:paymentMethodId
   */
  deletePaymentMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId, paymentMethodId } = req.params;
      await this.paymentMethodService.deletePaymentMethod(organizationId, paymentMethodId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * デフォルト支払い方法設定
   * PUT /api/organizations/:organizationId/payment-methods/:paymentMethodId/default
   */
  setDefaultPaymentMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId, paymentMethodId } = req.params;
      const paymentMethod =
        await this.paymentMethodService.setDefaultPaymentMethod(
          organizationId,
          paymentMethodId
        );
      res.json({ paymentMethod });
    } catch (error) {
      next(error);
    }
  };

  /**
   * SetupIntent作成（Stripe Elements用）
   * POST /api/organizations/:organizationId/payment-methods/setup-intent
   */
  createSetupIntent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const result =
        await this.paymentMethodService.createSetupIntent(organizationId);
      res.json({ setupIntent: result });
    } catch (error) {
      next(error);
    }
  };

  // ====================================================================
  // Invoices
  // ====================================================================

  /**
   * 請求履歴取得（ページネーション付き）
   * GET /api/organizations/:organizationId/invoices
   */
  getInvoices = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { organizationId } = req.params;
      const pagination = paginationSchema.parse(req.query);
      const result = await this.invoiceService.getInvoices(
        organizationId,
        pagination
      );
      // フロントエンドが期待する形式に変換（data -> invoices）
      res.json({
        invoices: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const organizationBillingController = new OrganizationBillingController();
