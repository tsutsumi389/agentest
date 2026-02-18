import { Router } from 'express';
import { AdminSetupController } from '../../controllers/admin/setup.controller.js';
import { rateLimiter } from '../../middleware/rate-limiter.js';

const router: Router = Router();
const controller = new AdminSetupController();

/**
 * セットアップ状態を取得（認証不要）
 * GET /admin/setup/status
 */
router.get('/status', controller.getStatus);

/**
 * 初回セットアップ（認証不要、レート制限: 5回/15分）
 * POST /admin/setup
 */
router.post('/', rateLimiter({ max: 5, windowMs: 15 * 60 * 1000, routeId: 'admin-setup' }), controller.setup);

export default router;
