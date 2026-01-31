import { Router } from 'express';
import { AdminOrganizationsController } from '../../controllers/admin/organizations.controller.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminOrganizationsController();

/**
 * 組織一覧を取得
 * GET /admin/organizations
 */
router.get('/', requireAdminAuth(), controller.list);

/**
 * 組織詳細を取得
 * GET /admin/organizations/:id
 */
router.get('/:id', requireAdminAuth(), controller.getById);

export default router;
