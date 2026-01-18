import { Router } from 'express';
import { requireAuth, requireProjectRole } from '@agentest/auth';
import { ProjectController } from '../controllers/project.controller.js';
import { LabelController } from '../controllers/label.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const projectController = new ProjectController();
const labelController = new LabelController();

/**
 * プロジェクト作成
 * POST /api/projects
 */
router.post('/', requireAuth(authConfig), projectController.create);

/**
 * プロジェクト詳細取得
 * GET /api/projects/:projectId
 */
router.get('/:projectId', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), projectController.getById);

/**
 * プロジェクトダッシュボード統計取得
 * GET /api/projects/:projectId/dashboard
 */
router.get('/:projectId/dashboard', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), projectController.getDashboard);

/**
 * プロジェクト更新
 * PATCH /api/projects/:projectId
 */
router.patch('/:projectId', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE']), projectController.update);

/**
 * プロジェクト削除
 * DELETE /api/projects/:projectId
 */
router.delete('/:projectId', requireAuth(authConfig), requireProjectRole(['ADMIN']), projectController.delete);

/**
 * プロジェクトメンバー一覧取得
 * GET /api/projects/:projectId/members
 */
router.get('/:projectId/members', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), projectController.getMembers);

/**
 * プロジェクトにメンバー追加
 * POST /api/projects/:projectId/members
 */
router.post('/:projectId/members', requireAuth(authConfig), requireProjectRole(['ADMIN']), projectController.addMember);

/**
 * メンバーのロール更新
 * PATCH /api/projects/:projectId/members/:userId
 */
router.patch('/:projectId/members/:userId', requireAuth(authConfig), requireProjectRole(['ADMIN']), projectController.updateMemberRole);

/**
 * メンバーを削除
 * DELETE /api/projects/:projectId/members/:userId
 */
router.delete('/:projectId/members/:userId', requireAuth(authConfig), requireProjectRole(['ADMIN']), projectController.removeMember);

/**
 * プロジェクトの環境一覧取得
 * GET /api/projects/:projectId/environments
 */
router.get('/:projectId/environments', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), projectController.getEnvironments);

/**
 * 環境作成
 * POST /api/projects/:projectId/environments
 */
router.post('/:projectId/environments', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE']), projectController.createEnvironment);

/**
 * 環境更新
 * PATCH /api/projects/:projectId/environments/:environmentId
 */
router.patch('/:projectId/environments/:environmentId', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE']), projectController.updateEnvironment);

/**
 * 環境削除
 * DELETE /api/projects/:projectId/environments/:environmentId
 */
router.delete('/:projectId/environments/:environmentId', requireAuth(authConfig), requireProjectRole(['ADMIN']), projectController.deleteEnvironment);

/**
 * 環境並替
 * POST /api/projects/:projectId/environments/reorder
 */
router.post('/:projectId/environments/reorder', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE']), projectController.reorderEnvironments);

/**
 * プロジェクトのテストスイート一覧取得
 * GET /api/projects/:projectId/test-suites
 */
router.get('/:projectId/test-suites', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), projectController.getTestSuites);

/**
 * プロジェクトのテストスイートサジェスト（@メンション用）
 * GET /api/projects/:projectId/suggestions/test-suites
 */
router.get('/:projectId/suggestions/test-suites', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), projectController.suggestTestSuites);

/**
 * プロジェクトの履歴一覧取得
 * GET /api/projects/:projectId/histories
 */
router.get('/:projectId/histories', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ'], { allowDeletedProject: true }), projectController.getHistories);

/**
 * プロジェクト復元
 * POST /api/projects/:projectId/restore
 */
router.post('/:projectId/restore', requireAuth(authConfig), requireProjectRole(['ADMIN'], { allowDeletedProject: true }), projectController.restore);

// ============================================
// ラベル管理ルート
// ============================================

/**
 * ラベル一覧取得
 * GET /api/projects/:projectId/labels
 */
router.get('/:projectId/labels', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), labelController.getLabels);

/**
 * ラベル作成
 * POST /api/projects/:projectId/labels
 */
router.post('/:projectId/labels', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE']), labelController.createLabel);

/**
 * ラベル更新
 * PATCH /api/projects/:projectId/labels/:labelId
 */
router.patch('/:projectId/labels/:labelId', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE']), labelController.updateLabel);

/**
 * ラベル削除
 * DELETE /api/projects/:projectId/labels/:labelId
 */
router.delete('/:projectId/labels/:labelId', requireAuth(authConfig), requireProjectRole(['ADMIN']), labelController.deleteLabel);

export default router;
