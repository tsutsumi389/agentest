import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { AgentSessionController } from '../controllers/agent-session.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const agentSessionController = new AgentSessionController();

/**
 * MCPセッション一覧を取得
 * GET /api/agent-sessions
 */
router.get('/', requireAuth(authConfig), agentSessionController.getSessions);

/**
 * MCPセッションを終了
 * DELETE /api/agent-sessions/:sessionId
 */
router.delete('/:sessionId', requireAuth(authConfig), agentSessionController.endSession);

export default router;
