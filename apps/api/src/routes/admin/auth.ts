import { Router } from 'express';
import { AdminAuthController } from '../../controllers/admin/auth.controller.js';
import { AdminProfileController } from '../../controllers/admin/profile.controller.js';
import { AdminTotpController } from '../../controllers/admin/totp.controller.js';
import { AdminPasswordResetController } from '../../controllers/admin/password-reset.controller.js';
import { requireAdminAuth, requireAdminAuthSkipTotp } from '../../middleware/require-admin-role.js';
import { rateLimiter } from '../../middleware/rate-limiter.js';
import { csrfProtection } from '../../middleware/csrf.middleware.js';

const router: Router = Router();
const controller = new AdminAuthController();
const profileController = new AdminProfileController();
const totpController = new AdminTotpController();
const passwordResetController = new AdminPasswordResetController();

// CSRF保護インスタンス（全POST/PUT/PATCHエンドポイントで使用）
const csrf = csrfProtection();

// ==================== パスワードリセット（認証不要） ====================

/**
 * パスワードリセット要求
 * POST /admin/auth/password-reset/request
 */
router.post(
  '/password-reset/request',
  csrf,
  rateLimiter({ max: 3, windowMs: 60_000, routeId: 'admin-pw-reset-req' }),
  passwordResetController.requestReset
);

/**
 * パスワードリセット実行
 * POST /admin/auth/password-reset/reset
 */
router.post(
  '/password-reset/reset',
  csrf,
  rateLimiter({ max: 5, windowMs: 60_000, routeId: 'admin-pw-reset' }),
  passwordResetController.resetPassword
);

// ==================== 認証エンドポイント ====================

/**
 * ログイン
 * POST /admin/auth/login
 */
router.post(
  '/login',
  csrf,
  rateLimiter({ max: 5, windowMs: 60_000, routeId: 'admin-login' }),
  controller.login
);

/**
 * ログアウト
 * POST /admin/auth/logout
 * TOTP検証前でもログアウト可能
 */
router.post('/logout', csrf, requireAdminAuthSkipTotp(), controller.logout);

/**
 * 現在の管理者情報を取得
 * GET /admin/auth/me
 */
router.get('/me', requireAdminAuth(), controller.me);

/**
 * セッション延長
 * POST /admin/auth/refresh
 */
router.post('/refresh', csrf, requireAdminAuth(), controller.refresh);

// ==================== プロフィール ====================

/**
 * プロフィール更新（名前変更）
 * PATCH /admin/auth/profile
 */
router.patch('/profile', csrf, requireAdminAuth(), profileController.updateProfile);

/**
 * パスワード変更
 * PUT /admin/auth/password
 */
router.put('/password', csrf, requireAdminAuth(), profileController.changePassword);

// ==================== 2FA (TOTP) エンドポイント ====================

/**
 * 2FAセットアップ開始
 * POST /admin/auth/2fa/setup
 *
 * QRコードと秘密鍵を返却
 */
router.post('/2fa/setup', csrf, requireAdminAuth(), totpController.setup);

/**
 * 2FA有効化
 * POST /admin/auth/2fa/enable
 *
 * ユーザーが入力したTOTPコードを検証し、有効化
 */
router.post('/2fa/enable', csrf, requireAdminAuth(), totpController.enable);

/**
 * 2FA検証（ログイン時）
 * POST /admin/auth/2fa/verify
 *
 * ログイン後の2要素認証検証
 * TOTP検証前のセッションでもアクセス可能
 */
router.post(
  '/2fa/verify',
  csrf,
  requireAdminAuthSkipTotp(),
  rateLimiter({ max: 5, windowMs: 60_000, routeId: 'admin-2fa-verify' }),
  totpController.verify
);

/**
 * 2FA無効化
 * POST /admin/auth/2fa/disable
 *
 * パスワード確認後、2要素認証を無効化
 */
router.post('/2fa/disable', csrf, requireAdminAuth(), totpController.disable);

export default router;
