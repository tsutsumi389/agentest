import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UserService } from '../../services/user.service.js';

const router: Router = Router();
const userService = new UserService();

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
router.get(
  '/users/:userId/test-suites',
  async (req: Request, res: Response, next: NextFunction) => {
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
  }
);

export default router;
