import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { z } from 'zod';
import { requireInternalApiAuth } from '../middleware/internal-api.middleware.js';
import { UserService } from '../services/user.service.js';
import { InternalAuthorizationService } from '../services/internal-authorization.service.js';
import { TestSuiteService } from '../services/test-suite.service.js';

const router: RouterType = Router();
const userService = new UserService();
const authService = new InternalAuthorizationService();
const testSuiteService = new TestSuiteService();

// 全エンドポイントに内部API認証を適用
router.use(requireInternalApiAuth());

/**
 * プロジェクト検索クエリパラメータのスキーマ
 */
const getUserProjectsQuerySchema = z.object({
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * テストスイート検索クエリパラメータのスキーマ
 */
const getUserTestSuitesQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  q: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * テストケース検索クエリパラメータのスキーマ
 */
const getTestCasesQuerySchema = z.object({
  userId: z.string().uuid(),
  q: z.string().max(100).optional(),
  status: z.array(z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])).optional(),
  priority: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['title', 'createdAt', 'updatedAt', 'priority', 'orderKey']).default('orderKey'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * 実行履歴検索クエリパラメータのスキーマ
 */
const getExecutionsQuerySchema = z.object({
  userId: z.string().uuid(),
  status: z.array(z.enum(['IN_PROGRESS', 'COMPLETED', 'ABORTED'])).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['startedAt', 'completedAt', 'status']).default('startedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /internal/api/users/:userId/projects
 * ユーザーがアクセス可能なプロジェクト一覧を取得
 */
router.get('/users/:userId/projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const parseResult = getUserProjectsQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const query = parseResult.data;
    const [projects, total] = await Promise.all([
      userService.getProjects(userId, query),
      userService.countProjects(userId, query),
    ]);

    res.json({
      projects,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + projects.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/api/users/:userId/test-suites
 * ユーザーがアクセス可能なテストスイート一覧を取得
 */
router.get('/users/:userId/test-suites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const parseResult = getUserTestSuitesQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const query = parseResult.data;
    const [testSuites, total] = await Promise.all([
      userService.getTestSuites(userId, query),
      userService.countTestSuites(userId, query),
    ]);

    res.json({
      testSuites,
      pagination: {
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + testSuites.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/api/test-suites/:testSuiteId/test-cases
 * テストスイート内のテストケース一覧を検索
 */
router.get('/test-suites/:testSuiteId/test-cases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testSuiteId } = req.params;
    const parseResult = getTestCasesQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const query = parseResult.data;

    // 認可チェック
    const canAccess = await authService.canAccessTestSuite(query.userId, testSuiteId);
    if (!canAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // テストケース検索
    const result = await testSuiteService.searchTestCases(testSuiteId, {
      q: query.q,
      status: query.status,
      priority: query.priority,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeDeleted: false,
    });

    res.json({
      testCases: result.items,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + result.items.length < result.total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/api/test-suites/:testSuiteId/executions
 * テストスイートの実行履歴を検索
 */
router.get('/test-suites/:testSuiteId/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testSuiteId } = req.params;
    const parseResult = getExecutionsQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const query = parseResult.data;

    // 認可チェック
    const canAccess = await authService.canAccessTestSuite(query.userId, testSuiteId);
    if (!canAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // 実行履歴検索
    const result = await testSuiteService.getExecutions(testSuiteId, {
      status: query.status,
      from: query.from,
      to: query.to,
      limit: query.limit,
      offset: query.offset,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    res.json({
      executions: result.executions,
      pagination: {
        total: result.total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + result.executions.length < result.total,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
