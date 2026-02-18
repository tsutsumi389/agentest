import { Router } from 'express';
import { AdminSetupController } from '../../controllers/admin/setup.controller.js';
import { csrfProtection } from '../../middleware/csrf.middleware.js';

const router: Router = Router();
const controller = new AdminSetupController();

/**
 * セットアップ状態を取得（認証不要）
 * GET /admin/setup/status
 */
router.get('/status', controller.getStatus);

/**
 * 初回セットアップ（認証不要、CSRF保護）
 * POST /admin/setup
 */
router.post('/', csrfProtection(), controller.setup);

export default router;
