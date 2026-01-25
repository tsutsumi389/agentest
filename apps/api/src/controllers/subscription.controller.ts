/**
 * サブスクリプションコントローラー
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { SubscriptionService } from '../services/subscription.service.js';
import { AuthorizationError } from '@agentest/shared';

/**
 * サブスクリプション作成スキーマ
 */
const createSubscriptionSchema = z.object({
  plan: z.literal('PRO'),
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
  paymentMethodId: z.string().uuid(),
});

/**
 * サブスクリプションコントローラー
 */
export class SubscriptionController {
  private subscriptionService = new SubscriptionService();

  /**
   * サブスクリプション取得
   * GET /api/users/:userId/subscription
   */
  getSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のサブスクリプションのみ取得可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のサブスクリプションのみ取得できます');
      }

      const subscription = await this.subscriptionService.getSubscription(userId);

      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * サブスクリプション作成（アップグレード）
   * POST /api/users/:userId/subscription
   */
  createSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のサブスクリプションのみ作成可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のサブスクリプションのみ作成できます');
      }

      const input = createSubscriptionSchema.parse(req.body);
      const subscription = await this.subscriptionService.createSubscription(
        userId,
        input
      );

      res.status(201).json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * サブスクリプションキャンセル（ダウングレード予約）
   * DELETE /api/users/:userId/subscription
   */
  cancelSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のサブスクリプションのみキャンセル可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のサブスクリプションのみキャンセルできます');
      }

      const subscription = await this.subscriptionService.cancelSubscription(userId);

      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ダウングレードキャンセル（サブスクリプション継続）
   * POST /api/users/:userId/subscription/reactivate
   */
  reactivateSubscription = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = req.params;

      // 自分のサブスクリプションのみ再開可能
      if (req.user?.id !== userId) {
        throw new AuthorizationError('自分のサブスクリプションのみ再開できます');
      }

      const subscription = await this.subscriptionService.reactivateSubscription(userId);

      res.json({ subscription });
    } catch (error) {
      next(error);
    }
  };
}
