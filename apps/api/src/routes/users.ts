import { Router } from 'express';
import { requireAuth } from '@agentest/auth';
import { UserController } from '../controllers/user.controller.js';
import { SubscriptionController } from '../controllers/subscription.controller.js';
import { PaymentMethodController } from '../controllers/payment-method.controller.js';
import { UserInvoiceController } from '../controllers/user-invoice.controller.js';
import { authConfig } from '../config/auth.js';
import { requireOwnership } from '../middleware/require-ownership.js';
import { billingLimiter } from '../middleware/rate-limiter.js';

const router: Router = Router();
const userController = new UserController();
const subscriptionController = new SubscriptionController();
const paymentMethodController = new PaymentMethodController();
const userInvoiceController = new UserInvoiceController();

// 認証 + オーナーシップチェックのミドルウェアチェーン
const authWithOwnership = [requireAuth(authConfig), requireOwnership()];

// 課金API用ミドルウェアチェーン（認証 + オーナーシップ + レート制限）
const billingMiddleware = [requireAuth(authConfig), requireOwnership(), billingLimiter];

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
// サブスクリプション関連（認証 + オーナーシップ + レート制限）
// ============================================

/**
 * サブスクリプション取得
 * GET /api/users/:userId/subscription
 */
router.get('/:userId/subscription', authWithOwnership, subscriptionController.getSubscription);

/**
 * サブスクリプション作成（アップグレード）- レート制限あり
 * POST /api/users/:userId/subscription
 */
router.post('/:userId/subscription', billingMiddleware, subscriptionController.createSubscription);

/**
 * サブスクリプションキャンセル（ダウングレード予約）- レート制限あり
 * DELETE /api/users/:userId/subscription
 */
router.delete('/:userId/subscription', billingMiddleware, subscriptionController.cancelSubscription);

/**
 * ダウングレードキャンセル（サブスクリプション継続）- レート制限あり
 * POST /api/users/:userId/subscription/reactivate
 */
router.post('/:userId/subscription/reactivate', billingMiddleware, subscriptionController.reactivateSubscription);

// ============================================
// 支払い方法関連（認証 + オーナーシップ + レート制限）
// ============================================

/**
 * SetupIntent作成（Stripe Elements用）
 * POST /api/users/:userId/payment-methods/setup-intent
 */
router.post('/:userId/payment-methods/setup-intent', billingMiddleware, paymentMethodController.createSetupIntent);

/**
 * 支払い方法一覧取得
 * GET /api/users/:userId/payment-methods
 */
router.get('/:userId/payment-methods', authWithOwnership, paymentMethodController.getPaymentMethods);

/**
 * 支払い方法追加 - レート制限あり
 * POST /api/users/:userId/payment-methods
 */
router.post('/:userId/payment-methods', billingMiddleware, paymentMethodController.addPaymentMethod);

/**
 * 支払い方法削除 - レート制限あり
 * DELETE /api/users/:userId/payment-methods/:paymentMethodId
 */
router.delete('/:userId/payment-methods/:paymentMethodId', billingMiddleware, paymentMethodController.deletePaymentMethod);

/**
 * デフォルト支払い方法設定 - レート制限あり
 * PUT /api/users/:userId/payment-methods/:paymentMethodId/default
 */
router.put('/:userId/payment-methods/:paymentMethodId/default', billingMiddleware, paymentMethodController.setDefaultPaymentMethod);

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
