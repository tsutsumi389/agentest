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
 * 前提条件結果更新
 * PATCH /api/executions/:executionId/preconditions/:preconditionResultId
 * 権限: WRITE以上
 */
router.patch(
  '/:executionId/preconditions/:preconditionResultId',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN']),
  executionController.updatePreconditionResult
);

/**
 * ステップ結果更新
 * PATCH /api/executions/:executionId/steps/:stepResultId
 * 権限: WRITE以上
 */
router.patch(
  '/:executionId/steps/:stepResultId',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN']),
  executionController.updateStepResult
);

/**
 * 期待結果更新
 * PATCH /api/executions/:executionId/expected-results/:expectedResultId
 * 権限: WRITE以上
 */
router.patch(
  '/:executionId/expected-results/:expectedResultId',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN']),
  executionController.updateExpectedResult
);

/**
 * エビデンスアップロード
 * POST /api/executions/:executionId/expected-results/:expectedResultId/evidences
 * 権限: WRITE以上
 */
router.post(
  '/:executionId/expected-results/:expectedResultId/evidences',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN']),
  ExecutionController.evidenceUploadMiddleware,
  executionController.uploadEvidence
);

/**
 * エビデンス削除
 * DELETE /api/executions/:executionId/evidences/:evidenceId
 * 権限: WRITE以上
 */
router.delete(
  '/:executionId/evidences/:evidenceId',
  requireAuth(authConfig),
  requireExecutionRole(['WRITE', 'ADMIN']),
  executionController.deleteEvidence
);

/**
 * エビデンスダウンロードURL取得
 * GET /api/executions/:executionId/evidences/:evidenceId/download-url
 * 権限: READ以上
 */
router.get(
  '/:executionId/evidences/:evidenceId/download-url',
  requireAuth(authConfig),
  requireExecutionRole(['READ', 'WRITE', 'ADMIN']),
  executionController.getEvidenceDownloadUrl
);

export default router;
