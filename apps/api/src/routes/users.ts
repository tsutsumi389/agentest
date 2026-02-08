import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { UserController } from '../controllers/user.controller.js';
import { UserPasswordController } from '../controllers/user-password.controller.js';
import { SubscriptionController } from '../controllers/subscription.controller.js';
import { PaymentMethodController } from '../controllers/payment-method.controller.js';
import { UserInvoiceController } from '../controllers/user-invoice.controller.js';
import { authConfig } from '../config/auth.js';
import { requireOwnership } from '../middleware/require-ownership.js';

const router: Router = Router();
const userController = new UserController();
const passwordController = new UserPasswordController();
const subscriptionController = new SubscriptionController();
const paymentMethodController = new PaymentMethodController();
const userInvoiceController = new UserInvoiceController();

// 認証 + オーナーシップチェックのミドルウェアチェーン
const authWithOwnership = [requireAuth(authConfig), requireOwnership()];

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
 * 最近のテスト実行結果取得
 * GET /api/users/:userId/recent-executions
 */
router.get('/:userId/recent-executions', requireAuth(authConfig), userController.getRecentExecutions);

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

// ============================================
// サブスクリプション関連（認証 + オーナーシップ）
// ============================================

/**
 * サブスクリプション取得
 * GET /api/users/:userId/subscription
 */
router.get('/:userId/subscription', authWithOwnership, subscriptionController.getSubscription);

/**
 * サブスクリプション作成（アップグレード）
 * POST /api/users/:userId/subscription
 */
router.post('/:userId/subscription', authWithOwnership, subscriptionController.createSubscription);

/**
 * サブスクリプションキャンセル（ダウングレード予約）
 * DELETE /api/users/:userId/subscription
 */
router.delete('/:userId/subscription', authWithOwnership, subscriptionController.cancelSubscription);

/**
 * ダウングレードキャンセル（サブスクリプション継続）
 * POST /api/users/:userId/subscription/reactivate
 */
router.post('/:userId/subscription/reactivate', authWithOwnership, subscriptionController.reactivateSubscription);

// ============================================
// 支払い方法関連（認証 + オーナーシップ）
// ============================================

/**
 * SetupIntent作成（Stripe Elements用）
 * POST /api/users/:userId/payment-methods/setup-intent
 */
router.post('/:userId/payment-methods/setup-intent', authWithOwnership, paymentMethodController.createSetupIntent);

/**
 * 支払い方法一覧取得
 * GET /api/users/:userId/payment-methods
 */
router.get('/:userId/payment-methods', authWithOwnership, paymentMethodController.getPaymentMethods);

/**
 * 支払い方法追加
 * POST /api/users/:userId/payment-methods
 */
router.post('/:userId/payment-methods', authWithOwnership, paymentMethodController.addPaymentMethod);

/**
 * 支払い方法削除
 * DELETE /api/users/:userId/payment-methods/:paymentMethodId
 */
router.delete('/:userId/payment-methods/:paymentMethodId', authWithOwnership, paymentMethodController.deletePaymentMethod);

/**
 * デフォルト支払い方法設定
 * PUT /api/users/:userId/payment-methods/:paymentMethodId/default
 */
router.put('/:userId/payment-methods/:paymentMethodId/default', authWithOwnership, paymentMethodController.setDefaultPaymentMethod);

// ============================================
// 請求履歴関連（認証 + オーナーシップ）
// ============================================

/**
 * 請求履歴一覧取得
 * GET /api/users/:userId/invoices
 */
router.get('/:userId/invoices', authWithOwnership, userInvoiceController.getInvoices);

/**
 * 請求書詳細取得
 * GET /api/users/:userId/invoices/:invoiceId
 */
router.get('/:userId/invoices/:invoiceId', authWithOwnership, userInvoiceController.getInvoice);

/**
 * 請求書PDFダウンロード
 * GET /api/users/:userId/invoices/:invoiceId/pdf
 */
router.get('/:userId/invoices/:invoiceId/pdf', authWithOwnership, userInvoiceController.getInvoicePdf);

export default router;
