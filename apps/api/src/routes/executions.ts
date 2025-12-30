import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { ExecutionController } from '../controllers/execution.controller.js';
import { requireExecutionRole } from '../middleware/require-execution-role.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const executionController = new ExecutionController();

/**
 * 実行詳細取得（軽量版）
 * GET /api/executions/:executionId
 * 権限: READ以上
 */
router.get(
  '/:executionId',
  requireAuth(authConfig),
  requireExecutionRole(['READ', 'WRITE', 'ADMIN']),
  executionController.getById
);

/**
 * 実行詳細取得（スナップショット、全結果データ含む）
 * GET /api/executions/:executionId/details
 * 権限: READ以上
 */
router.get(
  '/:executionId/details',
  requireAuth(authConfig),
  requireExecutionRole(['READ', 'WRITE', 'ADMIN']),
  executionController.getByIdWithDetails
);

/**
 * 実行中止
 * POST /api/executions/:executionId/abort
 * 権限: WRITE以上
 */
router.post(
  '/:executionId/abort',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN'], { allowCompletedExecution: false }),
  executionController.abort
);

/**
 * 実行完了
 * POST /api/executions/:executionId/complete
 * 権限: WRITE以上
 */
router.post(
  '/:executionId/complete',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN'], { allowCompletedExecution: false }),
  executionController.complete
);

/**
 * 前提条件結果更新
 * PATCH /api/executions/:executionId/preconditions/:preconditionResultId
 * 権限: WRITE以上、進行中の実行のみ
 */
router.patch(
  '/:executionId/preconditions/:preconditionResultId',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN'], { allowCompletedExecution: false }),
  executionController.updatePreconditionResult
);

/**
 * ステップ結果更新
 * PATCH /api/executions/:executionId/steps/:stepResultId
 * 権限: WRITE以上、進行中の実行のみ
 */
router.patch(
  '/:executionId/steps/:stepResultId',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN'], { allowCompletedExecution: false }),
  executionController.updateStepResult
);

/**
 * 期待結果更新
 * PATCH /api/executions/:executionId/expected-results/:expectedResultId
 * 権限: WRITE以上、進行中の実行のみ
 */
router.patch(
  '/:executionId/expected-results/:expectedResultId',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN'], { allowCompletedExecution: false }),
  executionController.updateExpectedResult
);

/**
 * エビデンスアップロード
 * POST /api/executions/:executionId/expected-results/:expectedResultId/evidences
 * 権限: WRITE以上、進行中の実行のみ
 */
router.post(
  '/:executionId/expected-results/:expectedResultId/evidences',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN'], { allowCompletedExecution: false }),
  executionController.uploadEvidence
);

export default router;
