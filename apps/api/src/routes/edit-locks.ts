import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { EditLockController } from '../controllers/edit-lock.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const editLockController = new EditLockController();

/**
 * ロック状態確認
 * GET /api/locks?targetType=SUITE&targetId={uuid}
 */
router.get('/', requireAuth(authConfig), editLockController.getStatus);

/**
 * ロック取得
 * POST /api/locks
 */
router.post('/', requireAuth(authConfig), editLockController.acquire);

/**
 * ハートビート更新
 * PATCH /api/locks/:lockId/heartbeat
 */
router.patch('/:lockId/heartbeat', requireAuth(authConfig), editLockController.heartbeat);

/**
 * ロック解放
 * DELETE /api/locks/:lockId
 */
router.delete('/:lockId', requireAuth(authConfig), editLockController.release);

/**
 * 強制ロック解除（管理者用）
 * DELETE /api/locks/:lockId/force
 * TODO: 管理者権限チェックを追加
 */
router.delete('/:lockId/force', requireAuth(authConfig), editLockController.forceRelease);

export default router;
