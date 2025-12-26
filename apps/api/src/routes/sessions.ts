import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { SessionController } from '../controllers/session.controller.js';
import { env } from '../config/env.js';

const router = Router();
const sessionController = new SessionController();

// 認証設定
const authConfig = {
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiry: env.JWT_REFRESH_EXPIRES_IN,
  },
  cookie: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
  },
  oauth: {},
};

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
