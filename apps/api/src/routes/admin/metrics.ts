import { Router } from 'express';
import { AdminMetricsController } from '../../controllers/admin/metrics.controller.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminMetricsController();

/**
 * アクティブユーザーメトリクスを取得
 * GET /admin/metrics/active-users
 */
router.get('/active-users', requireAdminAuth(), controller.getActiveUserMetrics);

/**
 * プラン分布メトリクスを取得
 * GET /admin/metrics/plan-distribution
 */
router.get('/plan-distribution', requireAdminAuth(), controller.getPlanDistribution);

export default router;
