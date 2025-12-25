import { Router } from 'express';
import { requireAuth, requireProjectRole } from '@agentest/auth';
import { ProjectController } from '../controllers/project.controller.js';
import { env } from '../config/env.js';

const router = Router();
const projectController = new ProjectController();

const authConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

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
 * プロジェクトのテストスイート一覧取得
 * GET /api/projects/:projectId/test-suites
 */
router.get('/:projectId/test-suites', requireAuth(authConfig), requireProjectRole(['ADMIN', 'WRITE', 'READ']), projectController.getTestSuites);

export default router;
