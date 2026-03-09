import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EditLockService } from '../../services/edit-lock.service.js';

const router: Router = Router();
const editLockService = new EditLockService();

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
