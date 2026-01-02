import { Router } from 'express';
import type { Request, Response, NextFunction, Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@agentest/db';
import { requireInternalApiAuth } from '../middleware/internal-api.middleware.js';
import { UserService } from '../services/user.service.js';
import { InternalAuthorizationService } from '../services/internal-authorization.service.js';
import { TestSuiteService } from '../services/test-suite.service.js';
import { TestCaseService } from '../services/test-case.service.js';
import { ExecutionService } from '../services/execution.service.js';

const router: RouterType = Router();
const userService = new UserService();
const authService = new InternalAuthorizationService();
const testSuiteService = new TestSuiteService();
const testCaseService = new TestCaseService();
const executionService = new ExecutionService();

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

/**
 * 単一取得APIのuserIdクエリパラメータスキーマ
 */
const userIdQuerySchema = z.object({
  userId: z.string().uuid(),
});

/**
 * GET /internal/api/projects/:projectId
 * プロジェクト詳細を取得
 */
router.get('/projects/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const parseResult = userIdQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { userId } = parseResult.data;

    // 認可チェック
    const canAccess = await authService.canAccessProject(userId, projectId);
    if (!canAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this project',
      });
      return;
    }

    // プロジェクト詳細を取得（環境、ロール含む）
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        environments: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: { testSuites: { where: { deletedAt: null } } },
        },
      },
    });

    if (!project) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Project not found',
      });
      return;
    }

    // ユーザーのロールを取得
    const projectMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });

    res.json({
      project: {
        ...project,
        role: projectMember?.role ?? 'VIEWER',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/api/test-suites/:testSuiteId
 * テストスイート詳細を取得（テストケース一覧含む）
 */
router.get('/test-suites/:testSuiteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testSuiteId } = req.params;
    const parseResult = userIdQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { userId } = parseResult.data;

    // 認可チェック
    const canAccess = await authService.canAccessTestSuite(userId, testSuiteId);
    if (!canAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // テストスイート詳細を取得
    const testSuite = await prisma.testSuite.findFirst({
      where: {
        id: testSuiteId,
        deletedAt: null,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        preconditions: {
          orderBy: { orderKey: 'asc' },
        },
        testCases: {
          where: { deletedAt: null },
          include: {
            _count: {
              select: { preconditions: true, steps: true, expectedResults: true },
            },
          },
          orderBy: { orderKey: 'asc' },
        },
        _count: {
          select: {
            testCases: { where: { deletedAt: null } },
            preconditions: true,
          },
        },
      },
    });

    if (!testSuite) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Test suite not found',
      });
      return;
    }

    res.json({ testSuite });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/api/test-cases/:testCaseId
 * テストケース詳細を取得（ステップ、期待結果含む）
 */
router.get('/test-cases/:testCaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testCaseId } = req.params;
    const parseResult = userIdQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { userId } = parseResult.data;

    // テストケースを取得してテストスイートIDを確認
    const testCase = await prisma.testCase.findFirst({
      where: {
        id: testCaseId,
        deletedAt: null,
      },
      include: {
        testSuite: {
          select: { id: true, name: true, projectId: true },
        },
        createdByUser: {
          select: { id: true, name: true, avatarUrl: true },
        },
        preconditions: {
          orderBy: { orderKey: 'asc' },
        },
        steps: {
          orderBy: { orderKey: 'asc' },
        },
        expectedResults: {
          orderBy: { orderKey: 'asc' },
        },
      },
    });

    if (!testCase) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Test case not found',
      });
      return;
    }

    // 認可チェック（テストスイート経由）
    const canAccess = await authService.canAccessTestSuite(userId, testCase.testSuiteId);
    if (!canAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test case',
      });
      return;
    }

    res.json({ testCase });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /internal/api/executions/:executionId
 * 実行詳細を取得（全結果データ含む）
 */
router.get('/executions/:executionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId } = req.params;
    const parseResult = userIdQuerySchema.safeParse(req.query);

    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { userId } = parseResult.data;

    // 実行詳細を取得
    const execution = await executionService.findByIdWithDetails(executionId);

    // 認可チェック（テストスイート経由）
    const canAccess = await authService.canAccessTestSuite(userId, execution.testSuiteId);
    if (!canAccess) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this execution',
      });
      return;
    }

    res.json({ execution });
  } catch (error) {
    next(error);
  }
});

/**
 * テストスイート作成リクエストボディのスキーマ
 */
const createTestSuiteBodySchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

/**
 * POST /internal/api/test-suites
 * テストスイートを作成
 */
router.post('/test-suites', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ボディ検証
    const bodyResult = createTestSuiteBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { projectId, name, description, status } = bodyResult.data;

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToProject(userId, projectId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this project',
      });
      return;
    }

    // テストスイート作成
    const testSuite = await testSuiteService.create(userId, {
      projectId,
      name,
      description,
      status,
    });

    res.status(201).json({ testSuite });
  } catch (error) {
    next(error);
  }
});

/**
 * テストケース作成リクエストボディのスキーマ
 */
const createTestCaseBodySchema = z.object({
  testSuiteId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
});

/**
 * POST /internal/api/test-cases
 * テストケースを作成
 */
router.post('/test-cases', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ボディ検証
    const bodyResult = createTestCaseBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { testSuiteId, title, description, priority, status } = bodyResult.data;

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToTestSuite(userId, testSuiteId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // テストケース作成
    const testCase = await testCaseService.create(userId, {
      testSuiteId,
      title,
      description,
      priority,
      status,
    });

    res.status(201).json({ testCase });
  } catch (error) {
    next(error);
  }
});

/**
 * 実行開始リクエストボディのスキーマ
 */
const startExecutionBodySchema = z.object({
  environmentId: z.string().uuid().optional(),
});

/**
 * POST /internal/api/test-suites/:testSuiteId/executions
 * テスト実行を開始
 */
router.post('/test-suites/:testSuiteId/executions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testSuiteId } = req.params;

    // userIdクエリ検証
    const userIdResult = userIdQuerySchema.safeParse(req.query);
    if (!userIdResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: userIdResult.error.flatten(),
      });
      return;
    }

    const { userId } = userIdResult.data;

    // ボディ検証
    const bodyResult = startExecutionBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { environmentId } = bodyResult.data;

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToTestSuite(userId, testSuiteId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // テスト実行開始
    const execution = await testSuiteService.startExecution(testSuiteId, userId, {
      environmentId,
    });

    res.status(201).json({ execution });
  } catch (error) {
    next(error);
  }
});

export default router;
