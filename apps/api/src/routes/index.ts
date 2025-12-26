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

const router = Router();

// ヘルスチェック（認証不要）
router.use('/', healthRoutes);

// API ルート
router.use('/api/auth', authRoutes);
router.use('/api/sessions', sessionRoutes);
router.use('/api/users', userRoutes);
router.use('/api/organizations', organizationRoutes);
router.use('/api/projects', projectRoutes);
router.use('/api/test-suites', testSuiteRoutes);
router.use('/api/test-cases', testCaseRoutes);
router.use('/api/executions', executionRoutes);

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
