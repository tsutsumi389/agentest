import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@agentest/db';
import { InternalAuthorizationService } from '../../services/internal-authorization.service.js';
import { TestCaseService } from '../../services/test-case.service.js';

const router: Router = Router();
const authService = new InternalAuthorizationService();
const testCaseService = new TestCaseService();

/**
 * 単一取得APIのuserIdクエリパラメータスキーマ
 */
const userIdQuerySchema = z.object({
  userId: z.string().uuid(),
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

export default router;
