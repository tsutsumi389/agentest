import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { TestCaseController } from '../controllers/test-case.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const testCaseController = new TestCaseController();

/**
 * テストケース作成
 * POST /api/test-cases
 */
router.post('/', requireAuth(authConfig), testCaseController.create);

/**
 * テストケース詳細取得
 * GET /api/test-cases/:testCaseId
 */
router.get('/:testCaseId', requireAuth(authConfig), testCaseController.getById);

/**
 * テストケース更新
 * PATCH /api/test-cases/:testCaseId
 */
router.patch('/:testCaseId', requireAuth(authConfig), testCaseController.update);

/**
 * テストケース削除
 * DELETE /api/test-cases/:testCaseId
 */
router.delete('/:testCaseId', requireAuth(authConfig), testCaseController.delete);

/**
 * テストケースの前提条件一覧取得
 * GET /api/test-cases/:testCaseId/preconditions
 */
router.get('/:testCaseId/preconditions', requireAuth(authConfig), testCaseController.getPreconditions);

/**
 * 前提条件追加
 * POST /api/test-cases/:testCaseId/preconditions
 */
router.post('/:testCaseId/preconditions', requireAuth(authConfig), testCaseController.addPrecondition);

/**
 * テストケースのステップ一覧取得
 * GET /api/test-cases/:testCaseId/steps
 */
router.get('/:testCaseId/steps', requireAuth(authConfig), testCaseController.getSteps);

/**
 * ステップ追加
 * POST /api/test-cases/:testCaseId/steps
 */
router.post('/:testCaseId/steps', requireAuth(authConfig), testCaseController.addStep);

/**
 * テストケースの期待結果一覧取得
 * GET /api/test-cases/:testCaseId/expected-results
 */
router.get('/:testCaseId/expected-results', requireAuth(authConfig), testCaseController.getExpectedResults);

/**
 * 期待結果追加
 * POST /api/test-cases/:testCaseId/expected-results
 */
router.post('/:testCaseId/expected-results', requireAuth(authConfig), testCaseController.addExpectedResult);

export default router;
