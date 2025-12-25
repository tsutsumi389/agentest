import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { ExecutionController } from '../controllers/execution.controller.js';
import { env } from '../config/env.js';

const router = Router();
const executionController = new ExecutionController();

const authConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

/**
 * 実行詳細取得
 * GET /api/executions/:executionId
 */
router.get('/:executionId', requireAuth(authConfig), executionController.getById);

/**
 * 実行中止
 * POST /api/executions/:executionId/abort
 */
router.post('/:executionId/abort', requireAuth(authConfig), executionController.abort);

/**
 * 実行完了
 * POST /api/executions/:executionId/complete
 */
router.post('/:executionId/complete', requireAuth(authConfig), executionController.complete);

/**
 * 前提条件結果更新
 * PATCH /api/executions/:executionId/preconditions/:preconditionResultId
 */
router.patch('/:executionId/preconditions/:preconditionResultId', requireAuth(authConfig), executionController.updatePreconditionResult);

/**
 * ステップ結果更新
 * PATCH /api/executions/:executionId/steps/:stepResultId
 */
router.patch('/:executionId/steps/:stepResultId', requireAuth(authConfig), executionController.updateStepResult);

/**
 * 期待結果更新
 * PATCH /api/executions/:executionId/expected-results/:expectedResultId
 */
router.patch('/:executionId/expected-results/:expectedResultId', requireAuth(authConfig), executionController.updateExpectedResult);

/**
 * エビデンスアップロード
 * POST /api/executions/:executionId/expected-results/:expectedResultId/evidences
 */
router.post('/:executionId/expected-results/:expectedResultId/evidences', requireAuth(authConfig), executionController.uploadEvidence);

export default router;
