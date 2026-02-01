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

export default router;
