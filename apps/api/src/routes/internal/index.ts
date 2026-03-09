import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { requireInternalApiAuth } from '../../middleware/internal-api.middleware.js';
import userRoutes from './users.js';
import projectRoutes from './projects.js';
import testSuiteRoutes from './test-suites.js';
import testCaseRoutes from './test-cases.js';
import executionRoutes from './executions.js';
import apiTokenRoutes from './api-tokens.js';
import lockRoutes from './locks.js';

const router: RouterType = Router();

// 全エンドポイントに内部API認証を適用
router.use(requireInternalApiAuth());

// 各機能モジュールのルートを統合
router.use(userRoutes);
router.use(projectRoutes);
router.use(testSuiteRoutes);
router.use(testCaseRoutes);
router.use(executionRoutes);
router.use(apiTokenRoutes);
router.use(lockRoutes);

export default router;
