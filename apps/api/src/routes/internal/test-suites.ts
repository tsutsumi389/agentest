import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@agentest/db';
import { InternalAuthorizationService } from '../../services/internal-authorization.service.js';
import { TestSuiteService } from '../../services/test-suite.service.js';

const router: Router = Router();
const authService = new InternalAuthorizationService();
const testSuiteService = new TestSuiteService();

/**
 * 単一取得APIのuserIdクエリパラメータスキーマ
 */
const userIdQuerySchema = z.object({
  userId: z.string().uuid(),
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
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
    const startExecutionBodySchema = z.object({
      environmentId: z.string().uuid().optional(),
    });

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

export default router;
