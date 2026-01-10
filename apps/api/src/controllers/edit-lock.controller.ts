import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import type { LockTargetType } from '@agentest/db';
import { EditLockService, LOCK_CONFIG } from '../services/edit-lock.service.js';

/**
 * ロック取得リクエストスキーマ
 */
const acquireLockSchema = z.object({
  targetType: z.enum(['SUITE', 'CASE']),
  targetId: z.string().uuid(),
});

/**
 * ロック状態確認クエリスキーマ
 */
const getLockStatusSchema = z.object({
  targetType: z.enum(['SUITE', 'CASE']),
  targetId: z.string().uuid(),
});

/**
 * 編集ロックコントローラー
 */
export class EditLockController {
  private editLockService = new EditLockService();

  /**
   * ロックを取得
   * POST /api/locks
   */
  acquire = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = acquireLockSchema.parse(req.body);
      const user = req.user!;

      const lock = await this.editLockService.acquireLock(
        data.targetType as LockTargetType,
        data.targetId,
        {
          type: 'user',
          id: user.id,
          name: user.name,
        }
      );

      res.status(201).json({
        lock: {
          id: lock.id,
          targetType: lock.targetType,
          targetId: lock.targetId,
          lockedBy: lock.lockedBy,
          expiresAt: lock.expiresAt.toISOString(),
        },
        config: {
          heartbeatIntervalSeconds: LOCK_CONFIG.HEARTBEAT_INTERVAL_SECONDS,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ロック状態を確認
   * GET /api/locks
   */
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = getLockStatusSchema.parse(req.query);

      const status = await this.editLockService.getLockStatus(
        query.targetType as LockTargetType,
        query.targetId
      );

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
  };

  /**
   * ハートビート更新
   * PATCH /api/locks/:lockId/heartbeat
   */
  heartbeat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { lockId } = req.params;
      const user = req.user!;

      const lock = await this.editLockService.updateHeartbeat(lockId, {
        type: 'user',
        id: user.id,
        name: user.name,
      });

      res.json({
        lock: {
          id: lock.id,
          targetType: lock.targetType,
          targetId: lock.targetId,
          lockedBy: lock.lockedBy,
          expiresAt: lock.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * ロックを解放
   * DELETE /api/locks/:lockId
   */
  release = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { lockId } = req.params;
      const user = req.user!;

      await this.editLockService.releaseLock(lockId, {
        type: 'user',
        id: user.id,
        name: user.name,
      });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 強制ロック解除（管理者用）
   * DELETE /api/locks/:lockId/force
   */
  forceRelease = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { lockId } = req.params;

      const lock = await this.editLockService.forceRelease(lockId);

      if (lock) {
        res.json({
          message: 'Lock forcibly released',
          releasedLock: {
            id: lock.id,
            targetType: lock.targetType,
            targetId: lock.targetId,
          },
        });
      } else {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lock not found',
          },
        });
      }
    } catch (error) {
      next(error);
    }
  };
}
