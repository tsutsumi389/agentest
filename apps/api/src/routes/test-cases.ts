import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { TestCaseController } from '../controllers/test-case.controller.js';
import { requireTestCaseRole } from '../middleware/require-test-case-role.js';
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
 * 前提条件並び替え
 * POST /api/test-cases/:testCaseId/preconditions/reorder
 */
router.post('/:testCaseId/preconditions/reorder', requireAuth(authConfig), testCaseController.reorderPreconditions);

/**
 * 前提条件更新
 * PATCH /api/test-cases/:testCaseId/preconditions/:preconditionId
 */
router.patch('/:testCaseId/preconditions/:preconditionId', requireAuth(authConfig), testCaseController.updatePrecondition);

/**
 * 前提条件削除
 * DELETE /api/test-cases/:testCaseId/preconditions/:preconditionId
 */
router.delete('/:testCaseId/preconditions/:preconditionId', requireAuth(authConfig), testCaseController.deletePrecondition);

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
 * ステップ並び替え
 * POST /api/test-cases/:testCaseId/steps/reorder
 */
router.post('/:testCaseId/steps/reorder', requireAuth(authConfig), testCaseController.reorderSteps);

/**
 * ステップ更新
 * PATCH /api/test-cases/:testCaseId/steps/:stepId
 */
router.patch('/:testCaseId/steps/:stepId', requireAuth(authConfig), testCaseController.updateStep);

/**
 * ステップ削除
 * DELETE /api/test-cases/:testCaseId/steps/:stepId
 */
router.delete('/:testCaseId/steps/:stepId', requireAuth(authConfig), testCaseController.deleteStep);

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

/**
 * 期待結果並び替え
 * POST /api/test-cases/:testCaseId/expected-results/reorder
 */
router.post('/:testCaseId/expected-results/reorder', requireAuth(authConfig), testCaseController.reorderExpectedResults);

/**
 * 期待結果更新
 * PATCH /api/test-cases/:testCaseId/expected-results/:expectedResultId
 */
router.patch('/:testCaseId/expected-results/:expectedResultId', requireAuth(authConfig), testCaseController.updateExpectedResult);

/**
 * 期待結果削除
 * DELETE /api/test-cases/:testCaseId/expected-results/:expectedResultId
 */
router.delete('/:testCaseId/expected-results/:expectedResultId', requireAuth(authConfig), testCaseController.deleteExpectedResult);

/**
 * テストケースコピー
 * POST /api/test-cases/:testCaseId/copy
 */
router.post('/:testCaseId/copy', requireAuth(authConfig), testCaseController.copy);

/**
 * 履歴取得
 * GET /api/test-cases/:testCaseId/histories
 */
router.get('/:testCaseId/histories', requireAuth(authConfig), testCaseController.getHistories);

/**
 * テストケース復元
 * POST /api/test-cases/:testCaseId/restore
 * 削除済みテストケースを復元（30日以内のみ）
 */
router.post('/:testCaseId/restore', requireAuth(authConfig), requireTestCaseRole(['ADMIN', 'WRITE'], { allowDeletedTestCase: true }), testCaseController.restore);

export default router;
