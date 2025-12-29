import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { TestCaseController } from '../controllers/test-case.controller.js';
import { requireTestCaseRole } from '../middleware/require-test-case-role.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const testCaseController = new TestCaseController();

// 読み取り権限（READ以上）
const readRoles = ['OWNER', 'ADMIN', 'WRITE', 'READ'] as const;
// 書き込み権限（WRITE以上）
const writeRoles = ['OWNER', 'ADMIN', 'WRITE'] as const;

/**
 * テストケース作成
 * POST /api/test-cases
 * 注: testSuiteIdをリクエストボディで受け取るため、サービス層で認可チェック
 */
router.post('/', requireAuth(authConfig), testCaseController.create);

/**
 * テストケース詳細取得
 * GET /api/test-cases/:testCaseId
 */
router.get('/:testCaseId', requireTestCaseRole([...readRoles]), testCaseController.getById);

/**
 * テストケース更新
 * PATCH /api/test-cases/:testCaseId
 */
router.patch('/:testCaseId', requireTestCaseRole([...writeRoles]), testCaseController.update);

/**
 * テストケース削除
 * DELETE /api/test-cases/:testCaseId
 */
router.delete('/:testCaseId', requireTestCaseRole([...writeRoles]), testCaseController.delete);

/**
 * テストケースの前提条件一覧取得
 * GET /api/test-cases/:testCaseId/preconditions
 */
router.get('/:testCaseId/preconditions', requireTestCaseRole([...readRoles]), testCaseController.getPreconditions);

/**
 * 前提条件追加
 * POST /api/test-cases/:testCaseId/preconditions
 */
router.post('/:testCaseId/preconditions', requireTestCaseRole([...writeRoles]), testCaseController.addPrecondition);

/**
 * 前提条件並び替え
 * POST /api/test-cases/:testCaseId/preconditions/reorder
 */
router.post('/:testCaseId/preconditions/reorder', requireTestCaseRole([...writeRoles]), testCaseController.reorderPreconditions);

/**
 * 前提条件更新
 * PATCH /api/test-cases/:testCaseId/preconditions/:preconditionId
 */
router.patch('/:testCaseId/preconditions/:preconditionId', requireTestCaseRole([...writeRoles]), testCaseController.updatePrecondition);

/**
 * 前提条件削除
 * DELETE /api/test-cases/:testCaseId/preconditions/:preconditionId
 */
router.delete('/:testCaseId/preconditions/:preconditionId', requireTestCaseRole([...writeRoles]), testCaseController.deletePrecondition);

/**
 * テストケースのステップ一覧取得
 * GET /api/test-cases/:testCaseId/steps
 */
router.get('/:testCaseId/steps', requireTestCaseRole([...readRoles]), testCaseController.getSteps);

/**
 * ステップ追加
 * POST /api/test-cases/:testCaseId/steps
 */
router.post('/:testCaseId/steps', requireTestCaseRole([...writeRoles]), testCaseController.addStep);

/**
 * ステップ並び替え
 * POST /api/test-cases/:testCaseId/steps/reorder
 */
router.post('/:testCaseId/steps/reorder', requireTestCaseRole([...writeRoles]), testCaseController.reorderSteps);

/**
 * ステップ更新
 * PATCH /api/test-cases/:testCaseId/steps/:stepId
 */
router.patch('/:testCaseId/steps/:stepId', requireTestCaseRole([...writeRoles]), testCaseController.updateStep);

/**
 * ステップ削除
 * DELETE /api/test-cases/:testCaseId/steps/:stepId
 */
router.delete('/:testCaseId/steps/:stepId', requireTestCaseRole([...writeRoles]), testCaseController.deleteStep);

/**
 * テストケースの期待結果一覧取得
 * GET /api/test-cases/:testCaseId/expected-results
 */
router.get('/:testCaseId/expected-results', requireTestCaseRole([...readRoles]), testCaseController.getExpectedResults);

/**
 * 期待結果追加
 * POST /api/test-cases/:testCaseId/expected-results
 */
router.post('/:testCaseId/expected-results', requireTestCaseRole([...writeRoles]), testCaseController.addExpectedResult);

/**
 * 期待結果並び替え
 * POST /api/test-cases/:testCaseId/expected-results/reorder
 */
router.post('/:testCaseId/expected-results/reorder', requireTestCaseRole([...writeRoles]), testCaseController.reorderExpectedResults);

/**
 * 期待結果更新
 * PATCH /api/test-cases/:testCaseId/expected-results/:expectedResultId
 */
router.patch('/:testCaseId/expected-results/:expectedResultId', requireTestCaseRole([...writeRoles]), testCaseController.updateExpectedResult);

/**
 * 期待結果削除
 * DELETE /api/test-cases/:testCaseId/expected-results/:expectedResultId
 */
router.delete('/:testCaseId/expected-results/:expectedResultId', requireTestCaseRole([...writeRoles]), testCaseController.deleteExpectedResult);

/**
 * テストケースコピー
 * POST /api/test-cases/:testCaseId/copy
 */
router.post('/:testCaseId/copy', requireTestCaseRole([...writeRoles]), testCaseController.copy);

/**
 * 履歴取得
 * GET /api/test-cases/:testCaseId/histories
 */
router.get('/:testCaseId/histories', requireTestCaseRole([...readRoles]), testCaseController.getHistories);

/**
 * テストケース復元
 * POST /api/test-cases/:testCaseId/restore
 * 削除済みテストケースを復元（30日以内のみ）
 */
router.post('/:testCaseId/restore', requireTestCaseRole(['OWNER', 'ADMIN', 'WRITE'], { allowDeletedTestCase: true }), testCaseController.restore);

export default router;
