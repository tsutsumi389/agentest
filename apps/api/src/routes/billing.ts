/**
 * 課金関連ルート
 */

import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { PlansController } from '../controllers/plans.controller.js';
import { authConfig } from '../config/auth.js';
import { billingLimiter } from '../middleware/rate-limiter.js';

const router: Router = Router();
const plansController = new PlansController();

/**
 * プラン一覧取得（認証不要）
 * GET /api/plans
 */
router.get('/plans', plansController.getPlans);

/**
 * 料金計算（認証必要、レート制限あり）
 * GET /api/plans/:plan/calculate
 */
router.get(
  '/plans/:plan/calculate',
  requireAuth(authConfig),
  billingLimiter,
  plansController.calculatePlanChange
);

export default router;
