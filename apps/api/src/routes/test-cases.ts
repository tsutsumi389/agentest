import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { TestCaseController } from '../controllers/test-case.controller.js';
import { ReviewCommentController } from '../controllers/review-comment.controller.js';
import { requireTestCaseRole } from '../middleware/require-test-case-role.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const testCaseController = new TestCaseController();
const reviewCommentController = new ReviewCommentController();

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
 * 削除済みテストケースの閲覧も許可（ゴミ箱フィルタからの詳細表示用）
 */
router.get(
  '/:testCaseId',
  requireAuth(authConfig),
  requireTestCaseRole([...readRoles], { allowDeletedTestCase: true }),
  testCaseController.getById
);

/**
 * テストケース更新
 * PATCH /api/test-cases/:testCaseId
 */
router.patch(
  '/:testCaseId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.update
);

/**
 * テストケース削除
 * DELETE /api/test-cases/:testCaseId
 */
router.delete(
  '/:testCaseId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.delete
);

/**
 * テストケースの前提条件一覧取得
 * GET /api/test-cases/:testCaseId/preconditions
 */
router.get(
  '/:testCaseId/preconditions',
  requireAuth(authConfig),
  requireTestCaseRole([...readRoles]),
  testCaseController.getPreconditions
);

/**
 * 前提条件追加
 * POST /api/test-cases/:testCaseId/preconditions
 */
router.post(
  '/:testCaseId/preconditions',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.addPrecondition
);

/**
 * 前提条件並び替え
 * POST /api/test-cases/:testCaseId/preconditions/reorder
 */
router.post(
  '/:testCaseId/preconditions/reorder',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.reorderPreconditions
);

/**
 * 前提条件更新
 * PATCH /api/test-cases/:testCaseId/preconditions/:preconditionId
 */
router.patch(
  '/:testCaseId/preconditions/:preconditionId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.updatePrecondition
);

/**
 * 前提条件削除
 * DELETE /api/test-cases/:testCaseId/preconditions/:preconditionId
 */
router.delete(
  '/:testCaseId/preconditions/:preconditionId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.deletePrecondition
);

/**
 * テストケースのステップ一覧取得
 * GET /api/test-cases/:testCaseId/steps
 */
router.get(
  '/:testCaseId/steps',
  requireAuth(authConfig),
  requireTestCaseRole([...readRoles]),
  testCaseController.getSteps
);

/**
 * ステップ追加
 * POST /api/test-cases/:testCaseId/steps
 */
router.post(
  '/:testCaseId/steps',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.addStep
);

/**
 * ステップ並び替え
 * POST /api/test-cases/:testCaseId/steps/reorder
 */
router.post(
  '/:testCaseId/steps/reorder',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.reorderSteps
);

/**
 * ステップ更新
 * PATCH /api/test-cases/:testCaseId/steps/:stepId
 */
router.patch(
  '/:testCaseId/steps/:stepId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.updateStep
);

/**
 * ステップ削除
 * DELETE /api/test-cases/:testCaseId/steps/:stepId
 */
router.delete(
  '/:testCaseId/steps/:stepId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.deleteStep
);

/**
 * テストケースの期待結果一覧取得
 * GET /api/test-cases/:testCaseId/expected-results
 */
router.get(
  '/:testCaseId/expected-results',
  requireAuth(authConfig),
  requireTestCaseRole([...readRoles]),
  testCaseController.getExpectedResults
);

/**
 * 期待結果追加
 * POST /api/test-cases/:testCaseId/expected-results
 */
router.post(
  '/:testCaseId/expected-results',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.addExpectedResult
);

/**
 * 期待結果並び替え
 * POST /api/test-cases/:testCaseId/expected-results/reorder
 */
router.post(
  '/:testCaseId/expected-results/reorder',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.reorderExpectedResults
);

/**
 * 期待結果更新
 * PATCH /api/test-cases/:testCaseId/expected-results/:expectedResultId
 */
router.patch(
  '/:testCaseId/expected-results/:expectedResultId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.updateExpectedResult
);

/**
 * 期待結果削除
 * DELETE /api/test-cases/:testCaseId/expected-results/:expectedResultId
 */
router.delete(
  '/:testCaseId/expected-results/:expectedResultId',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.deleteExpectedResult
);

/**
 * テストケースコピー
 * POST /api/test-cases/:testCaseId/copy
 */
router.post(
  '/:testCaseId/copy',
  requireAuth(authConfig),
  requireTestCaseRole([...writeRoles]),
  testCaseController.copy
);

/**
 * 履歴取得
 * GET /api/test-cases/:testCaseId/histories
 */
router.get(
  '/:testCaseId/histories',
  requireAuth(authConfig),
  requireTestCaseRole([...readRoles]),
  testCaseController.getHistories
);

/**
 * テストケース復元
 * POST /api/test-cases/:testCaseId/restore
 * 削除済みテストケースを復元（30日以内のみ）
 */
router.post(
  '/:testCaseId/restore',
  requireAuth(authConfig),
  requireTestCaseRole(['OWNER', 'ADMIN', 'WRITE'], { allowDeletedTestCase: true }),
  testCaseController.restore
);

/**
 * テストケースのレビューコメント一覧取得
 * GET /api/test-cases/:testCaseId/comments
 */
router.get(
  '/:testCaseId/comments',
  requireAuth(authConfig),
  requireTestCaseRole([...readRoles]),
  reviewCommentController.getTestCaseComments
);

export default router;
