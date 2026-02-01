import { Router } from 'express';
import { AdminAdminUsersController } from '../../controllers/admin/admin-users.controller.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminAdminUsersController();

/**
 * システム管理者一覧を取得
 * GET /admin/admin-users
 */
router.get('/', requireAdminAuth(), controller.list);

/**
 * システム管理者詳細を取得
 * GET /admin/admin-users/:id
 */
router.get('/:id', requireAdminAuth(), controller.getById);

/**
 * システム管理者を招待（作成）
 * POST /admin/admin-users
 */
router.post('/', requireAdminAuth(), controller.invite);

/**
 * システム管理者を更新
 * PATCH /admin/admin-users/:id
 */
router.patch('/:id', requireAdminAuth(), controller.update);

/**
 * システム管理者を削除
 * DELETE /admin/admin-users/:id
 */
router.delete('/:id', requireAdminAuth(), controller.delete);

/**
 * アカウントロックを解除
 * POST /admin/admin-users/:id/unlock
 */
router.post('/:id/unlock', requireAdminAuth(), controller.unlock);

/**
 * 2FAをリセット
 * POST /admin/admin-users/:id/reset-2fa
 */
router.post('/:id/reset-2fa', requireAdminAuth(), controller.reset2FA);

export default router;
