import { Router } from 'express';
import { AdminAuthController } from '../../controllers/admin/auth.controller.js';
import { AdminProfileController } from '../../controllers/admin/profile.controller.js';
import { AdminTotpController } from '../../controllers/admin/totp.controller.js';
import { AdminPasswordResetController } from '../../controllers/admin/password-reset.controller.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminAuthController();
const profileController = new AdminProfileController();
const totpController = new AdminTotpController();
const passwordResetController = new AdminPasswordResetController();

// ==================== パスワードリセット（認証不要） ====================

/**
 * パスワードリセット要求
 * POST /admin/auth/password-reset/request
 */
router.post('/password-reset/request', passwordResetController.requestReset);

/**
 * パスワードリセット実行
 * POST /admin/auth/password-reset/reset
 */
router.post('/password-reset/reset', passwordResetController.resetPassword);

// ==================== 認証エンドポイント ====================

/**
 * ログイン
 * POST /admin/auth/login
 */
router.post('/login', controller.login);

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

// ==================== プロフィール ====================

/**
 * プロフィール更新（名前変更）
 * PATCH /admin/auth/profile
 */
router.patch('/profile', requireAdminAuth(), profileController.updateProfile);

/**
 * パスワード変更
 * PUT /admin/auth/password
 */
router.put('/password', requireAdminAuth(), profileController.changePassword);

// ==================== 2FA (TOTP) エンドポイント ====================

/**
 * 2FAセットアップ開始
 * POST /admin/auth/2fa/setup
 *
 * QRコードと秘密鍵を返却
 */
router.post('/2fa/setup', requireAdminAuth(), totpController.setup);

/**
 * 2FA有効化
 * POST /admin/auth/2fa/enable
 *
 * ユーザーが入力したTOTPコードを検証し、有効化
 */
router.post('/2fa/enable', requireAdminAuth(), totpController.enable);

/**
 * 2FA検証（ログイン時）
 * POST /admin/auth/2fa/verify
 *
 * ログイン後の2要素認証検証
 */
router.post('/2fa/verify', requireAdminAuth(), totpController.verify);

/**
 * 2FA無効化
 * POST /admin/auth/2fa/disable
 *
 * パスワード確認後、2要素認証を無効化
 */
router.post('/2fa/disable', requireAdminAuth(), totpController.disable);

export default router;
