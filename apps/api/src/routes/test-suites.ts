import { Router } from 'express';
import { requireAuth, requireProjectRole } from '@agentest/auth';
import { TestSuiteController } from '../controllers/test-suite.controller.js';
import { env } from '../config/env.js';

const router = Router();
const testSuiteController = new TestSuiteController();

const authConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

/**
 * テストスイート作成
 * POST /api/test-suites
 */
router.post('/', requireAuth(authConfig), testSuiteController.create);

/**
 * テストスイート詳細取得
 * GET /api/test-suites/:testSuiteId
 */
router.get('/:testSuiteId', requireAuth(authConfig), testSuiteController.getById);

/**
 * テストスイート更新
 * PATCH /api/test-suites/:testSuiteId
 */
router.patch('/:testSuiteId', requireAuth(authConfig), testSuiteController.update);

/**
 * テストスイート削除
 * DELETE /api/test-suites/:testSuiteId
 */
router.delete('/:testSuiteId', requireAuth(authConfig), testSuiteController.delete);

/**
 * テストスイートのテストケース一覧取得
 * GET /api/test-suites/:testSuiteId/test-cases
 */
router.get('/:testSuiteId/test-cases', requireAuth(authConfig), testSuiteController.getTestCases);

/**
 * テストスイートの前提条件一覧取得
 * GET /api/test-suites/:testSuiteId/preconditions
 */
router.get('/:testSuiteId/preconditions', requireAuth(authConfig), testSuiteController.getPreconditions);

/**
 * テストスイートの前提条件追加
 * POST /api/test-suites/:testSuiteId/preconditions
 */
router.post('/:testSuiteId/preconditions', requireAuth(authConfig), testSuiteController.addPrecondition);

/**
 * テストスイートの実行履歴取得
 * GET /api/test-suites/:testSuiteId/executions
 */
router.get('/:testSuiteId/executions', requireAuth(authConfig), testSuiteController.getExecutions);

/**
 * テスト実行開始
 * POST /api/test-suites/:testSuiteId/executions
 */
router.post('/:testSuiteId/executions', requireAuth(authConfig), testSuiteController.startExecution);

export default router;
