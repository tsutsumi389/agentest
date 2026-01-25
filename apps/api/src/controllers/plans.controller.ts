/**
 * プランコントローラー
 */

import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  PERSONAL_PLAN_PRICING,
  calculateYearlySavings,
  type PersonalPlan,
} from '@agentest/shared';
import { SubscriptionService } from '../services/subscription.service.js';
import { AuthorizationError } from '@agentest/shared';

/**
 * プランパラメータスキーマ
 */
const planParamSchema = z.object({
  plan: z.enum(['FREE', 'PRO']),
});

/**
 * 料金計算クエリスキーマ
 */
const calculateQuerySchema = z.object({
  billingCycle: z.enum(['MONTHLY', 'YEARLY']),
});

/**
 * プラン情報レスポンス
 */
interface PlanInfo {
  plan: PersonalPlan;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlySavings: number;
  features: Array<{
    name: string;
    description: string;
    included: boolean;
  }>;
}

/**
 * プランコントローラー
 */
export class PlansController {
  private subscriptionService = new SubscriptionService();

  /**
   * プラン一覧取得（認証不要）
   * GET /api/plans
   */
  getPlans = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const plans: PlanInfo[] = (Object.keys(PERSONAL_PLAN_PRICING) as PersonalPlan[]).map(
        (plan) => {
          const pricing = PERSONAL_PLAN_PRICING[plan];
          return {
            plan,
            monthlyPrice: pricing.monthlyPrice,
            yearlyPrice: pricing.yearlyPrice,
            yearlySavings: calculateYearlySavings(plan),
            features: pricing.features,
          };
        }
      );

      res.json({ plans });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 料金計算（認証必要）
   * GET /api/plans/:plan/calculate
   */
  calculatePlanChange = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        throw new AuthorizationError('認証が必要です');
      }

      // プランパラメータの検証
      const { plan } = planParamSchema.parse(req.params);

      // クエリパラメータの検証
      const { billingCycle } = calculateQuerySchema.parse(req.query);

      const calculation = await this.subscriptionService.calculatePlanChange(
        userId,
        plan,
        billingCycle
      );

      res.json({ calculation });
    } catch (error) {
      next(error);
    }
  };
}
