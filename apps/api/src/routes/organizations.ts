import { Router } from 'express';
import { requireAuth, requireOrgRole } from '@agentest/auth';
import { OrganizationController } from '../controllers/organization.controller.js';
import { env } from '../config/env.js';

const router = Router();
const orgController = new OrganizationController();

const authConfig = {
  accessSecret: env.JWT_ACCESS_SECRET,
  refreshSecret: env.JWT_REFRESH_SECRET,
  accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
};

/**
 * 組織作成
 * POST /api/organizations
 */
router.post('/', requireAuth(authConfig), orgController.create);

/**
 * 組織詳細取得
 * GET /api/organizations/:organizationId
 */
router.get('/:organizationId', requireAuth(authConfig), orgController.getById);

/**
 * 組織更新
 * PATCH /api/organizations/:organizationId
 */
router.patch('/:organizationId', requireAuth(authConfig), requireOrgRole(['OWNER', 'ADMIN']), orgController.update);

/**
 * 組織削除
 * DELETE /api/organizations/:organizationId
 */
router.delete('/:organizationId', requireAuth(authConfig), requireOrgRole(['OWNER']), orgController.delete);

/**
 * 組織メンバー一覧取得
 * GET /api/organizations/:organizationId/members
 */
router.get('/:organizationId/members', requireAuth(authConfig), orgController.getMembers);

/**
 * 組織に招待
 * POST /api/organizations/:organizationId/invitations
 */
router.post('/:organizationId/invitations', requireAuth(authConfig), requireOrgRole(['OWNER', 'ADMIN']), orgController.invite);

/**
 * 招待を承認
 * POST /api/organizations/invitations/:token/accept
 */
router.post('/invitations/:token/accept', requireAuth(authConfig), orgController.acceptInvitation);

/**
 * メンバーのロール更新
 * PATCH /api/organizations/:organizationId/members/:userId
 */
router.patch('/:organizationId/members/:userId', requireAuth(authConfig), requireOrgRole(['OWNER', 'ADMIN']), orgController.updateMemberRole);

/**
 * メンバーを削除
 * DELETE /api/organizations/:organizationId/members/:userId
 */
router.delete('/:organizationId/members/:userId', requireAuth(authConfig), requireOrgRole(['OWNER', 'ADMIN']), orgController.removeMember);

/**
 * 組織のプロジェクト一覧取得
 * GET /api/organizations/:organizationId/projects
 */
router.get('/:organizationId/projects', requireAuth(authConfig), orgController.getProjects);

export default router;
