import { Router } from 'express';
import { AdminDashboardController } from '../../controllers/admin/dashboard.controller.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminDashboardController();

/**
 * ダッシュボード統計を取得
 * GET /admin/dashboard
 */
router.get('/', requireAdminAuth(), controller.getStats);

export default router;
