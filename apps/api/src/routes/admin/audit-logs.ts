import { Router } from 'express';
import { AdminAuditLogsController } from '../../controllers/admin/audit-logs.controller.js';
import { requireAdminAuth } from '../../middleware/require-admin-role.js';

const router: Router = Router();
const controller = new AdminAuditLogsController();

/**
 * 監査ログ一覧を取得
 * GET /admin/audit-logs
 */
router.get('/', requireAdminAuth(), controller.list);

export default router;
