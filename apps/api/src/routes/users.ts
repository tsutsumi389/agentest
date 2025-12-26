import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { UserController } from '../controllers/user.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const userController = new UserController();

/**
 * ユーザープロフィール取得
 * GET /api/users/:userId
 */
router.get('/:userId', requireAuth(authConfig), userController.getUser);

/**
 * ユーザープロフィール更新
 * PATCH /api/users/:userId
 */
router.patch('/:userId', requireAuth(authConfig), userController.updateUser);

/**
 * ユーザー削除（論理削除）
 * DELETE /api/users/:userId
 */
router.delete('/:userId', requireAuth(authConfig), userController.deleteUser);

/**
 * ユーザーの組織一覧取得
 * GET /api/users/:userId/organizations
 */
router.get('/:userId/organizations', requireAuth(authConfig), userController.getUserOrganizations);

/**
 * ユーザーのプロジェクト一覧取得
 * GET /api/users/:userId/projects
 */
router.get('/:userId/projects', requireAuth(authConfig), userController.getUserProjects);

/**
 * OAuth連携一覧取得
 * GET /api/users/:userId/accounts
 */
router.get('/:userId/accounts', requireAuth(authConfig), userController.getAccounts);

/**
 * OAuth連携解除
 * DELETE /api/users/:userId/accounts/:provider
 */
router.delete('/:userId/accounts/:provider', requireAuth(authConfig), userController.unlinkAccount);

export default router;
