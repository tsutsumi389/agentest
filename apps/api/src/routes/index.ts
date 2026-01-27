import { Router } from 'express';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import sessionRoutes from './sessions.js';
import userRoutes from './users.js';
import organizationRoutes from './organizations.js';
import projectRoutes from './projects.js';
import testSuiteRoutes from './test-suites.js';
import testCaseRoutes from './test-cases.js';
import executionRoutes from './executions.js';
import reviewCommentRoutes from './review-comments.js';
import reviewRoutes from './reviews.js';
import apiTokenRoutes from './api-tokens.js';
import editLockRoutes from './edit-locks.js';
import notificationRoutes from './notifications.js';
import internalRoutes from './internal.js';
import oauthRoutes from './oauth.js';
import billingRoutes from './billing.js';
import webhookRoutes from './webhooks.js';
import adminAuthRoutes from './admin/auth.js';
import adminDashboardRoutes from './admin/dashboard.js';
import adminUsersRoutes from './admin/users.js';
import adminOrganizationsRoutes from './admin/organizations.js';
import { oauthController } from '../controllers/oauth.controller.js';

const router: Router = Router();

// ヘルスチェック（認証不要）
router.use('/', healthRoutes);

// OAuth 2.1 Authorization Server Metadata (RFC 8414)
router.get('/.well-known/oauth-authorization-server', oauthController.getMetadata);

// API ルート
router.use('/api/auth', authRoutes);
router.use('/api/sessions', sessionRoutes);
router.use('/api/users', userRoutes);
router.use('/api/organizations', organizationRoutes);
router.use('/api/projects', projectRoutes);
router.use('/api/test-suites', testSuiteRoutes);
router.use('/api/test-cases', testCaseRoutes);
router.use('/api/executions', executionRoutes);
router.use('/api/review-comments', reviewCommentRoutes);
router.use('/api/reviews', reviewRoutes);
router.use('/api/api-tokens', apiTokenRoutes);
router.use('/api/locks', editLockRoutes);
router.use('/api/notifications', notificationRoutes);

// 課金関連ルート
router.use('/api', billingRoutes);

// Webhookルート（認証不要）
router.use('/webhooks', webhookRoutes);

// OAuth 2.1 エンドポイント (RFC 9728)
router.use('/oauth', oauthRoutes);

// 管理者認証
router.use('/admin/auth', adminAuthRoutes);

// 管理者ダッシュボード
router.use('/admin/dashboard', adminDashboardRoutes);

// 管理者ユーザー一覧
router.use('/admin/users', adminUsersRoutes);

// 管理者組織一覧
router.use('/admin/organizations', adminOrganizationsRoutes);

// 内部API（MCPサーバーからの呼び出し用）
router.use('/internal/api', internalRoutes);

// 404ハンドラー
router.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'リクエストされたリソースが見つかりません',
      statusCode: 404,
    },
  });
});

export default router;
