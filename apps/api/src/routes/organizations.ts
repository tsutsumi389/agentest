import { Router } from 'express';
import { requireAuth, requireOrgRole } from '@agentest/auth';
import { OrganizationController } from '../controllers/organization.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const orgController = new OrganizationController();

/**
 * 組織作成
 * POST /api/organizations
 */
router.post('/', requireAuth(authConfig), orgController.create);

// ====================================================================
// 招待関連ルート（認証不要/トークンベース）
// 注意: これらのルートは /:organizationId より前に定義する必要がある
// ====================================================================

/**
 * 招待詳細取得（認証不要）
 * GET /api/organizations/invitations/:token
 */
router.get('/invitations/:token', orgController.getInvitationByToken);

/**
 * 招待を承認
 * POST /api/organizations/invitations/:token/accept
 */
router.post('/invitations/:token/accept', requireAuth(authConfig), orgController.acceptInvitation);

/**
 * 招待を辞退
 * POST /api/organizations/invitations/:token/decline
 */
router.post('/invitations/:token/decline', requireAuth(authConfig), orgController.declineInvitation);

// ====================================================================
// 組織操作ルート（:organizationId パラメータを含む）
// ====================================================================

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
 * 組織復元
 * POST /api/organizations/:organizationId/restore
 * 削除済み組織のOWNERのみ実行可能
 */
router.post('/:organizationId/restore', requireAuth(authConfig), requireOrgRole(['OWNER'], { allowDeletedOrg: true }), orgController.restore);

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
 * 保留中の招待一覧取得
 * GET /api/organizations/:organizationId/invitations
 */
router.get('/:organizationId/invitations', requireAuth(authConfig), requireOrgRole(['OWNER', 'ADMIN']), orgController.getInvitations);

/**
 * 招待を取消
 * DELETE /api/organizations/:organizationId/invitations/:invitationId
 */
router.delete('/:organizationId/invitations/:invitationId', requireAuth(authConfig), requireOrgRole(['OWNER', 'ADMIN']), orgController.cancelInvitation);

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
 * オーナー権限移譲
 * POST /api/organizations/:organizationId/transfer-ownership
 */
router.post('/:organizationId/transfer-ownership', requireAuth(authConfig), requireOrgRole(['OWNER']), orgController.transferOwnership);

/**
 * 組織のプロジェクト一覧取得
 * GET /api/organizations/:organizationId/projects
 */
router.get('/:organizationId/projects', requireAuth(authConfig), orgController.getProjects);

/**
 * 監査ログ取得
 * GET /api/organizations/:organizationId/audit-logs
 */
router.get('/:organizationId/audit-logs', requireAuth(authConfig), requireOrgRole(['OWNER', 'ADMIN']), orgController.getAuditLogs);

export default router;
