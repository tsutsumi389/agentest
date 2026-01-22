import { Router } from 'express';
import {
  AdminAuthController,
  requireAdminAuth,
} from '../../controllers/admin/auth.controller.js';
import { adminAuthLimiter } from '../../middleware/rate-limiter.js';

const router: Router = Router();
const controller = new AdminAuthController();

/**
 * ログイン
 * POST /admin/auth/login
 */
router.post('/login', adminAuthLimiter, controller.login);

/**
 * ログアウト
 * POST /admin/auth/logout
 */
router.post('/logout', requireAdminAuth(), controller.logout);

/**
 * 現在の管理者情報を取得
 * GET /admin/auth/me
 */
router.get('/me', requireAdminAuth(), controller.me);

/**
 * セッション延長
 * POST /admin/auth/refresh
 */
router.post('/refresh', requireAdminAuth(), controller.refresh);

export default router;
