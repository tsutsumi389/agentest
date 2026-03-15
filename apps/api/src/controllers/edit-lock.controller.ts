import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, type LockTargetType } from '@agentest/db';
import { AuthorizationError, NotFoundError, AuthenticationError } from '@agentest/shared';
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
 * ロック対象からプロジェクトを取得し、ユーザーのADMIN権限をチェック
 * @param userId - チェック対象のユーザーID
 * @param targetType - ロック対象の種類
 * @param targetId - ロック対象のID
 * @throws AuthorizationError - 権限がない場合
 */
async function checkAdminAccess(
  userId: string,
  targetType: LockTargetType,
  targetId: string
): Promise<void> {
  let project: {
    id: string;
    organizationId: string | null;
    members: Array<{ role: string }>;
  } | null = null;

  if (targetType === 'SUITE') {
    const testSuite = await prisma.testSuite.findUnique({
      where: { id: targetId },
      include: {
        project: {
          include: {
            members: {
              where: { userId },
              select: { role: true },
            },
          },
        },
      },
    });
    project = testSuite?.project ?? null;
  } else {
    // CASE
    const testCase = await prisma.testCase.findUnique({
      where: { id: targetId },
      include: {
        testSuite: {
          include: {
            project: {
              include: {
                members: {
                  where: { userId },
                  select: { role: true },
                },
              },
            },
          },
        },
      },
    });
    project = testCase?.testSuite?.project ?? null;
  }

  if (!project) {
    throw new NotFoundError('Project', targetId);
  }

  // プロジェクトメンバーシップをチェック
  const member = project.members[0];
  if (member && (member.role === 'OWNER' || member.role === 'ADMIN')) {
    return;
  }

  // プロジェクトが組織に属する場合、組織メンバーシップをチェック
  if (project.organizationId) {
    const orgMember = await prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId,
        },
      },
    });

    if (orgMember && ['OWNER', 'ADMIN'].includes(orgMember.role)) {
      return;
    }
  }

  throw new AuthorizationError('Admin permission required to force release lock');
}

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
      const user = req.user;

      if (!user) {
        throw new AuthenticationError('Not authenticated');
      }

      // ロック情報を取得して認可チェック
      const existingLock = await prisma.editLock.findUnique({
        where: { id: lockId },
      });

      if (!existingLock) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Lock not found',
          },
        });
        return;
      }

      // ADMIN権限をチェック
      await checkAdminAccess(user.id, existingLock.targetType, existingLock.targetId);

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
