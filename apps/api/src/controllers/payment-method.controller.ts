/**
 * 支払い方法コントローラー
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PaymentMethodService } from '../services/payment-method.service.js';

/**
 * 支払い方法追加スキーマ
 */
const addPaymentMethodSchema = z.object({
  token: z.string().min(1, 'トークンは必須です'),
});

/**
 * 支払い方法コントローラー
 */
export class PaymentMethodController {
  private paymentMethodService = new PaymentMethodService();

  /**
   * 支払い方法一覧取得
   * GET /api/users/:userId/payment-methods
   */
  getPaymentMethods = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const paymentMethods =
        await this.paymentMethodService.getPaymentMethods(userId);
      res.json({ paymentMethods });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 支払い方法追加
   * POST /api/users/:userId/payment-methods
   */
  addPaymentMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;
      const { token } = addPaymentMethodSchema.parse(req.body);
      const paymentMethod = await this.paymentMethodService.addPaymentMethod(
        userId,
        token
      );
      res.status(201).json({ paymentMethod });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 支払い方法削除
   * DELETE /api/users/:userId/payment-methods/:paymentMethodId
   */
  deletePaymentMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId, paymentMethodId } = req.params;
      await this.paymentMethodService.deletePaymentMethod(userId, paymentMethodId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * デフォルト支払い方法設定
   * PUT /api/users/:userId/payment-methods/:paymentMethodId/default
   */
  setDefaultPaymentMethod = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId, paymentMethodId } = req.params;
      const paymentMethod = await this.paymentMethodService.setDefaultPaymentMethod(
        userId,
        paymentMethodId
      );
      res.json({ paymentMethod });
    } catch (error) {
      next(error);
    }
  };
}
