import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { UserController } from '../controllers/user.controller.js';
import { SubscriptionController } from '../controllers/subscription.controller.js';
import { PaymentMethodController } from '../controllers/payment-method.controller.js';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const userController = new UserController();
const subscriptionController = new SubscriptionController();
const paymentMethodController = new PaymentMethodController();

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
 * ダッシュボード統計取得
 * GET /api/users/:userId/dashboard
 */
router.get('/:userId/dashboard', requireAuth(authConfig), userController.getDashboard);

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

// ============================================
// サブスクリプション関連
// ============================================

/**
 * サブスクリプション取得
 * GET /api/users/:userId/subscription
 */
router.get('/:userId/subscription', requireAuth(authConfig), subscriptionController.getSubscription);

/**
 * サブスクリプション作成（アップグレード）
 * POST /api/users/:userId/subscription
 */
router.post('/:userId/subscription', requireAuth(authConfig), subscriptionController.createSubscription);

/**
 * サブスクリプションキャンセル（ダウングレード予約）
 * DELETE /api/users/:userId/subscription
 */
router.delete('/:userId/subscription', requireAuth(authConfig), subscriptionController.cancelSubscription);

/**
 * ダウングレードキャンセル（サブスクリプション継続）
 * POST /api/users/:userId/subscription/reactivate
 */
router.post('/:userId/subscription/reactivate', requireAuth(authConfig), subscriptionController.reactivateSubscription);

// ============================================
// 支払い方法関連
// ============================================

/**
 * 支払い方法一覧取得
 * GET /api/users/:userId/payment-methods
 */
router.get('/:userId/payment-methods', requireAuth(authConfig), paymentMethodController.getPaymentMethods);

/**
 * 支払い方法追加
 * POST /api/users/:userId/payment-methods
 */
router.post('/:userId/payment-methods', requireAuth(authConfig), paymentMethodController.addPaymentMethod);

/**
 * 支払い方法削除
 * DELETE /api/users/:userId/payment-methods/:paymentMethodId
 */
router.delete('/:userId/payment-methods/:paymentMethodId', requireAuth(authConfig), paymentMethodController.deletePaymentMethod);

/**
 * デフォルト支払い方法設定
 * PUT /api/users/:userId/payment-methods/:paymentMethodId/default
 */
router.put('/:userId/payment-methods/:paymentMethodId/default', requireAuth(authConfig), paymentMethodController.setDefaultPaymentMethod);

export default router;
