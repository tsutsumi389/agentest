import { Router } from 'express';
import { AdminUsersController } from '../../controllers/admin/users.controller.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminUsersController();

/**
 * ユーザー一覧を取得
 * GET /admin/users
 */
router.get('/', requireAdminAuth(), controller.list);

export default router;
