import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { SessionController } from '../controllers/session.controller.js';
import { authConfig } from '../config/auth.js';

const router = Router();
const sessionController = new SessionController();

/**
 * セッション一覧を取得
 * GET /api/sessions
 */
router.get('/', requireAuth(authConfig), sessionController.getSessions);

/**
 * セッション数を取得
 * GET /api/sessions/count
 */
router.get('/count', requireAuth(authConfig), sessionController.getSessionCount);

/**
 * 他の全セッションを終了
 * DELETE /api/sessions
 */
router.delete('/', requireAuth(authConfig), sessionController.revokeOtherSessions);

/**
 * 特定のセッションを終了
 * DELETE /api/sessions/:sessionId
 */
router.delete('/:sessionId', requireAuth(authConfig), sessionController.revokeSession);

export default router;
