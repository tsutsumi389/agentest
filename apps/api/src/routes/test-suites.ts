import { Router } from 'express';
import { requireAuth, requireProjectRole } from '@agentest/auth';
import { TestSuiteController } from '../controllers/test-suite.controller.js';
import { requireTestSuiteRole } from '../middleware/require-test-suite-role.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const testSuiteController = new TestSuiteController();

/**
 * テストスイート作成
 * POST /api/test-suites
 * body.projectIdでプロジェクト権限をチェック
 */
router.post('/', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE']), testSuiteController.create);

/**
 * テストスイート詳細取得
 * GET /api/test-suites/:testSuiteId
 */
router.get('/:testSuiteId', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE', 'READ']), testSuiteController.getById);

/**
 * テストスイート更新
 * PATCH /api/test-suites/:testSuiteId
 */
router.patch('/:testSuiteId', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE']), testSuiteController.update);

/**
 * テストスイート削除
 * DELETE /api/test-suites/:testSuiteId
 */
router.delete('/:testSuiteId', requireAuth(authConfig), requireTestSuiteRole(['ADMIN']), testSuiteController.delete);

/**
 * テストスイートのテストケース一覧取得
 * GET /api/test-suites/:testSuiteId/test-cases
 */
router.get('/:testSuiteId/test-cases', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE', 'READ']), testSuiteController.getTestCases);

/**
 * テストスイートのテストケースサジェスト（@メンション用）
 * GET /api/test-suites/:testSuiteId/suggestions/test-cases
 */
router.get('/:testSuiteId/suggestions/test-cases', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE', 'READ']), testSuiteController.suggestTestCases);

/**
 * テストスイートのテストケース並び替え
 * POST /api/test-suites/:testSuiteId/test-cases/reorder
 */
router.post('/:testSuiteId/test-cases/reorder', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE']), testSuiteController.reorderTestCases);

/**
 * テストスイートの前提条件一覧取得
 * GET /api/test-suites/:testSuiteId/preconditions
 */
router.get('/:testSuiteId/preconditions', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE', 'READ']), testSuiteController.getPreconditions);

/**
 * テストスイートの前提条件追加
 * POST /api/test-suites/:testSuiteId/preconditions
 */
router.post('/:testSuiteId/preconditions', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE']), testSuiteController.addPrecondition);

/**
 * テストスイートの前提条件更新
 * PATCH /api/test-suites/:testSuiteId/preconditions/:preconditionId
 */
router.patch('/:testSuiteId/preconditions/:preconditionId', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE']), testSuiteController.updatePrecondition);

/**
 * テストスイートの前提条件削除
 * DELETE /api/test-suites/:testSuiteId/preconditions/:preconditionId
 */
router.delete('/:testSuiteId/preconditions/:preconditionId', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE']), testSuiteController.deletePrecondition);

/**
 * テストスイートの前提条件並び替え
 * POST /api/test-suites/:testSuiteId/preconditions/reorder
 */
router.post('/:testSuiteId/preconditions/reorder', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE']), testSuiteController.reorderPreconditions);

/**
 * テストスイートの実行履歴取得
 * GET /api/test-suites/:testSuiteId/executions
 */
router.get('/:testSuiteId/executions', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE', 'READ']), testSuiteController.getExecutions);

/**
 * テスト実行開始
 * POST /api/test-suites/:testSuiteId/executions
 */
router.post('/:testSuiteId/executions', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE']), testSuiteController.startExecution);

/**
 * テストスイートの変更履歴取得
 * GET /api/test-suites/:testSuiteId/histories
 * 削除済みテストスイートからも履歴を取得可能
 */
router.get('/:testSuiteId/histories', requireAuth(authConfig), requireTestSuiteRole(['ADMIN', 'WRITE', 'READ'], { allowDeletedSuite: true }), testSuiteController.getHistories);

/**
 * テストスイート復元
 * POST /api/test-suites/:testSuiteId/restore
 * 削除済みテストスイートを復元（30日以内のみ）
 */
router.post('/:testSuiteId/restore', requireAuth(authConfig), requireTestSuiteRole(['ADMIN'], { allowDeletedSuite: true }), testSuiteController.restore);

export default router;
