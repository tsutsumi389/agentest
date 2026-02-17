import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { UserController } from '../controllers/user.controller.js';
import { UserPasswordController } from '../controllers/user-password.controller.js';
import { authConfig } from '../config/auth.js';
import { requireOwnership } from '../middleware/require-ownership.js';

const router: Router = Router();
const userController = new UserController();
const passwordController = new UserPasswordController();

// 認証 + オーナーシップチェックのミドルウェアチェーン
const authWithOwnership = [requireAuth(authConfig), requireOwnership()];

/**
 * ユーザープロフィール取得
 * GET /api/users/:userId
 */
router.get('/:userId', authWithOwnership, userController.getUser);

/**
 * ユーザープロフィール更新
 * PATCH /api/users/:userId
 */
router.patch('/:userId', authWithOwnership, userController.updateUser);

/**
 * ユーザー削除（論理削除）
 * DELETE /api/users/:userId
 */
router.delete('/:userId', authWithOwnership, userController.deleteUser);

/**
 * ユーザーの組織一覧取得
 * GET /api/users/:userId/organizations
 */
router.get('/:userId/organizations', authWithOwnership, userController.getUserOrganizations);

/**
 * ユーザーのプロジェクト一覧取得
 * GET /api/users/:userId/projects
 */
router.get('/:userId/projects', authWithOwnership, userController.getUserProjects);

/**
 * 最近のテスト実行結果取得
 * GET /api/users/:userId/recent-executions
 */
router.get('/:userId/recent-executions', authWithOwnership, userController.getRecentExecutions);

/**
 * OAuth連携一覧取得
 * GET /api/users/:userId/accounts
 */
router.get('/:userId/accounts', authWithOwnership, userController.getAccounts);

/**
 * OAuth連携解除
 * DELETE /api/users/:userId/accounts/:provider
 */
router.delete('/:userId/accounts/:provider', authWithOwnership, userController.unlinkAccount);

// ============================================
// パスワード管理関連（認証 + オーナーシップ）
// ============================================

/**
 * パスワード設定状況確認
 * GET /api/users/:userId/password/status
 */
router.get('/:userId/password/status', authWithOwnership, passwordController.getPasswordStatus);

/**
 * パスワード初回設定（OAuthユーザー向け）
 * POST /api/users/:userId/password
 */
router.post('/:userId/password', authWithOwnership, passwordController.setPassword);

/**
 * パスワード変更
 * PUT /api/users/:userId/password
 */
router.put('/:userId/password', authWithOwnership, passwordController.changePassword);

export default router;
