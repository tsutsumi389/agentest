import { Router } from 'express';
import { AdminAuthController } from '../../controllers/admin/auth.controller.js';
import { AdminTotpController } from '../../controllers/admin/totp.controller.js';
import { adminAuthLimiter } from '../../middleware/rate-limiter.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminAuthController();
const totpController = new AdminTotpController();

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

// ==================== 2FA (TOTP) エンドポイント ====================

/**
 * 2FAセットアップ開始
 * POST /admin/auth/2fa/setup
 *
 * QRコードと秘密鍵を返却
 */
router.post('/2fa/setup', adminAuthLimiter, requireAdminAuth(), totpController.setup);

/**
 * 2FA有効化
 * POST /admin/auth/2fa/enable
 *
 * ユーザーが入力したTOTPコードを検証し、有効化
 */
router.post('/2fa/enable', adminAuthLimiter, requireAdminAuth(), totpController.enable);

/**
 * 2FA検証（ログイン時）
 * POST /admin/auth/2fa/verify
 *
 * ログイン後の2要素認証検証
 */
router.post('/2fa/verify', adminAuthLimiter, requireAdminAuth(), totpController.verify);

/**
 * 2FA無効化
 * POST /admin/auth/2fa/disable
 *
 * パスワード確認後、2要素認証を無効化
 */
router.post('/2fa/disable', adminAuthLimiter, requireAdminAuth(), totpController.disable);

export default router;
