import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '@agentest/db';
import { InternalAuthorizationService } from '../../services/internal-authorization.service.js';

const router: Router = Router();
const authService = new InternalAuthorizationService();

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
          select: { id: true, name: true },
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

export default router;
