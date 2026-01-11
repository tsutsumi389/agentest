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
import { ApiTokenService } from '../services/api-token.service.js';
import { EditLockService } from '../services/edit-lock.service.js';
import { isAllowedMimeType, MAX_FILE_SIZE } from '../config/upload.js';

const router: RouterType = Router();
const userService = new UserService();
const authService = new InternalAuthorizationService();
const testSuiteService = new TestSuiteService();
const testCaseService = new TestCaseService();
const executionService = new ExecutionService();
const apiTokenService = new ApiTokenService();
const editLockService = new EditLockService();

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
 * 子エンティティ作成用スキーマ
 */
const childEntityCreateSchema = z.object({
  content: z.string().min(1).max(10000),
});

/**
 * 子エンティティ更新用スキーマ（idあり→更新、idなし→追加）
 */
const childEntityUpdateSchema = z.object({
  id: z.string().uuid().optional(),
  content: z.string().min(1).max(10000),
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
  preconditions: z.array(childEntityCreateSchema).optional(),
  steps: z.array(childEntityCreateSchema).optional(),
  expectedResults: z.array(childEntityCreateSchema).optional(),
});

/**
 * POST /internal/api/test-cases
 * テストケースを作成（子エンティティ含む）
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

    const { testSuiteId, title, description, priority, status, preconditions, steps, expectedResults } = bodyResult.data;

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToTestSuite(userId, testSuiteId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // テストケース作成（子エンティティ含む）
    const testCase = await testCaseService.create(userId, {
      testSuiteId,
      title,
      description,
      priority,
      status,
      preconditions,
      steps,
      expectedResults,
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
 * テストスイート更新リクエストボディのスキーマ
 */
const updateTestSuiteBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  groupId: z.string().uuid().optional(),
}).refine((data) => {
  // groupIdを除外してチェック
  const { groupId: _, ...rest } = data;
  return Object.keys(rest).length > 0;
}, {
  message: 'At least one field must be provided',
});

/**
 * テストケース更新リクエストボディのスキーマ
 */
const updateTestCaseBodySchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  preconditions: z.array(childEntityUpdateSchema).optional(),
  steps: z.array(childEntityUpdateSchema).optional(),
  expectedResults: z.array(childEntityUpdateSchema).optional(),
  groupId: z.string().uuid().optional(),
}).refine((data) => {
  // groupIdを除外してチェック
  const { groupId: _, ...rest } = data;
  return Object.keys(rest).length > 0;
}, {
  message: 'At least one field must be provided',
});

/**
 * 事前条件結果更新リクエストボディのスキーマ
 */
const updatePreconditionResultBodySchema = z.object({
  status: z.enum(['MET', 'NOT_MET']),
  note: z.string().max(2000).optional(),
});

/**
 * ステップ結果更新リクエストボディのスキーマ
 */
const updateStepResultBodySchema = z.object({
  status: z.enum(['DONE', 'SKIPPED']),
  note: z.string().max(2000).optional(),
});

/**
 * 期待結果更新リクエストボディのスキーマ
 */
const updateExpectedResultBodySchema = z.object({
  status: z.enum(['PASS', 'FAIL', 'SKIPPED', 'NOT_EXECUTABLE']),
  note: z.string().max(2000).optional(),
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

/**
 * PATCH /internal/api/test-suites/:testSuiteId
 * テストスイートを更新
 */
router.patch('/test-suites/:testSuiteId', async (req: Request, res: Response, next: NextFunction) => {
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
    const bodyResult = updateTestSuiteBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const updateData = bodyResult.data;

    // groupIdを分離
    const { groupId, ...updateDataWithoutGroupId } = updateData;

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToTestSuite(userId, testSuiteId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // テストスイート更新
    const testSuite = await testSuiteService.update(testSuiteId, userId, updateDataWithoutGroupId, { groupId });

    res.json({ testSuite });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /internal/api/test-cases/:testCaseId
 * テストケースを更新（子エンティティ含む差分更新）
 */
router.patch('/test-cases/:testCaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testCaseId } = req.params;

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
    const bodyResult = updateTestCaseBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const updateData = bodyResult.data;

    // テストケース取得（テストスイートIDを取得するため）
    const existingTestCase = await prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: { testSuiteId: true, deletedAt: true },
    });

    if (!existingTestCase || existingTestCase.deletedAt) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Test case not found',
      });
      return;
    }

    // 書き込み権限チェック（テストスイート経由）
    const canWrite = await authService.canWriteToTestSuite(userId, existingTestCase.testSuiteId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test case',
      });
      return;
    }

    // 子エンティティが含まれる場合は updateWithChildren を使用
    const hasChildEntities =
      updateData.preconditions !== undefined ||
      updateData.steps !== undefined ||
      updateData.expectedResults !== undefined;

    // groupIdを分離
    const { groupId, ...updateDataWithoutGroupId } = updateData;

    const testCase = hasChildEntities
      ? await testCaseService.updateWithChildren(testCaseId, userId, updateDataWithoutGroupId, groupId)
      : await testCaseService.update(testCaseId, userId, updateDataWithoutGroupId, groupId);

    res.json({ testCase });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /internal/api/executions/:executionId/precondition-results/:preconditionResultId
 * 事前条件結果を更新
 */
router.patch('/executions/:executionId/precondition-results/:preconditionResultId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, preconditionResultId } = req.params;

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
    const bodyResult = updatePreconditionResultBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { status, note } = bodyResult.data;

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // 事前条件結果更新
    const preconditionResult = await executionService.updatePreconditionResult(
      executionId,
      preconditionResultId,
      { status, note }
    );

    res.json({ preconditionResult });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /internal/api/executions/:executionId/step-results/:stepResultId
 * ステップ結果を更新
 */
router.patch('/executions/:executionId/step-results/:stepResultId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, stepResultId } = req.params;

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
    const bodyResult = updateStepResultBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { status, note } = bodyResult.data;

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // ステップ結果更新
    const stepResult = await executionService.updateStepResult(
      executionId,
      stepResultId,
      { status, note }
    );

    res.json({ stepResult });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /internal/api/executions/:executionId/expected-results/:expectedResultId
 * 期待結果を更新
 */
router.patch('/executions/:executionId/expected-results/:expectedResultId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, expectedResultId } = req.params;

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
    const bodyResult = updateExpectedResultBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { status, note } = bodyResult.data;

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // 期待結果更新
    const expectedResult = await executionService.updateExpectedResult(
      executionId,
      expectedResultId,
      { status, note }
    );

    res.json({ expectedResult });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /internal/api/test-suites/:testSuiteId
 * テストスイートを削除（論理削除）
 */
router.delete('/test-suites/:testSuiteId', async (req: Request, res: Response, next: NextFunction) => {
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

    // 書き込み権限チェック
    const canWrite = await authService.canWriteToTestSuite(userId, testSuiteId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test suite',
      });
      return;
    }

    // テストスイート削除
    await testSuiteService.softDelete(testSuiteId, userId);

    res.json({ success: true, deletedId: testSuiteId });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /internal/api/test-cases/:testCaseId
 * テストケースを削除（論理削除）
 */
router.delete('/test-cases/:testCaseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { testCaseId } = req.params;

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

    // テストケース取得（テストスイートIDを取得するため）
    const existingTestCase = await prisma.testCase.findUnique({
      where: { id: testCaseId },
      select: { testSuiteId: true, deletedAt: true },
    });

    if (!existingTestCase || existingTestCase.deletedAt) {
      res.status(404).json({
        error: 'Not Found',
        message: 'Test case not found',
      });
      return;
    }

    // 書き込み権限チェック（テストスイート経由）
    const canWrite = await authService.canWriteToTestSuite(userId, existingTestCase.testSuiteId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this test case',
      });
      return;
    }

    // テストケース削除
    await testCaseService.softDelete(testCaseId, userId);

    res.json({ success: true, deletedId: testCaseId });
  } catch (error) {
    next(error);
  }
});

/**
 * エビデンスアップロードリクエストボディのスキーマ（Base64形式）
 */
const uploadEvidenceBodySchema = z.object({
  fileName: z.string().min(1).max(255),
  fileData: z.string().min(1), // Base64エンコードされたデータ
  fileType: z.string().min(1),
  description: z.string().max(2000).optional(),
});

/**
 * POST /internal/api/executions/:executionId/expected-results/:expectedResultId/evidences
 * エビデンスをアップロード（Base64形式）
 */
router.post('/executions/:executionId/expected-results/:expectedResultId/evidences', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { executionId, expectedResultId } = req.params;

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
    const bodyResult = uploadEvidenceBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { fileName, fileData, fileType, description } = bodyResult.data;

    // 書き込み権限チェック（実行がIN_PROGRESSかつテストスイートへの書き込み権限）
    const canWrite = await authService.canWriteToExecution(userId, executionId);
    if (!canWrite) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied or execution is not in progress',
      });
      return;
    }

    // MIMEタイプ検証
    if (!isAllowedMimeType(fileType)) {
      res.status(400).json({
        error: 'Bad Request',
        message: '許可されていないファイル形式です',
      });
      return;
    }

    // Base64形式の事前検証（Buffer.fromは不正な文字を無視するため明示的にチェック）
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(fileData)) {
      res.status(400).json({
        error: 'Bad Request',
        message: '不正なBase64データです',
      });
      return;
    }

    // Base64デコード
    const buffer = Buffer.from(fileData, 'base64');

    // ファイルサイズ検証
    if (buffer.length > MAX_FILE_SIZE) {
      res.status(400).json({
        error: 'Bad Request',
        message: `ファイルサイズが上限（${MAX_FILE_SIZE / 1024 / 1024}MB）を超えています`,
      });
      return;
    }

    // Express.Multer.File形式に変換
    const file: Express.Multer.File = {
      fieldname: 'file',
      originalname: fileName,
      encoding: 'base64',
      mimetype: fileType,
      buffer,
      size: buffer.length,
      stream: undefined as never,
      destination: '',
      filename: '',
      path: '',
    };

    // エビデンスアップロード
    const evidence = await executionService.uploadEvidence(
      executionId,
      expectedResultId,
      userId,
      file,
      description
    );

    res.status(201).json({
      evidence: {
        id: evidence.id,
        expectedResultId: evidence.expectedResultId,
        fileName: evidence.fileName,
        fileUrl: evidence.fileUrl,
        fileType: evidence.fileType,
        // BigIntはJSON.stringify()で直接シリアライズできないため、Numberに変換
        fileSize: Number(evidence.fileSize),
        description: evidence.description,
        uploadedByUserId: evidence.uploadedByUserId,
        createdAt: evidence.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * APIトークン検証リクエストボディのスキーマ
 */
const validateApiTokenBodySchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /internal/api/api-token/validate
 * APIキーを検証（MCP内部通信用）
 */
router.post('/api-token/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // ボディ検証
    const bodyResult = validateApiTokenBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request body',
        details: bodyResult.error.flatten(),
      });
      return;
    }

    const { token } = bodyResult.data;

    // トークン検証
    const result = await apiTokenService.validateToken(token);

    res.json({
      valid: result.valid,
      userId: result.userId,
      organizationId: result.organizationId,
      scopes: result.scopes,
      tokenId: result.tokenId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * ロック状態確認クエリパラメータのスキーマ
 */
const getLockStatusQuerySchema = z.object({
  targetType: z.enum(['SUITE', 'CASE']),
  targetId: z.string().uuid(),
});

/**
 * GET /internal/api/locks
 * ロック状態を確認（MCP楽観的ロック確認用）
 */
router.get('/locks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parseResult = getLockStatusQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid query parameters',
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { targetType, targetId } = parseResult.data;

    // ロック状態を確認
    const status = await editLockService.getLockStatus(targetType, targetId);

    if (status.lock) {
      res.json({
        isLocked: true,
        lock: {
          id: status.lock.id,
          targetType: status.lock.targetType,
          targetId: status.lock.targetId,
          lockedBy: status.lock.lockedBy,
          expiresAt: status.lock.expiresAt.toISOString(),
        },
      });
    } else {
      res.json({
        isLocked: false,
        lock: null,
      });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
