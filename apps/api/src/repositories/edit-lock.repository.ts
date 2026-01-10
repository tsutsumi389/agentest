import { prisma, type LockTargetType, type EditLock } from '@agentest/db';

/**
 * ロック作成データ
 */
export interface CreateEditLockData {
  targetType: LockTargetType;
  targetId: string;
  lockedByUserId: string;
  expiresAt: Date;
}

/**
 * 編集ロックリポジトリ
 */
export class EditLockRepository {
  /**
   * ターゲット（スイート/ケース）でロックを検索
   */
  async findByTarget(targetType: LockTargetType, targetId: string): Promise<EditLock | null> {
    return prisma.editLock.findUnique({
      where: {
        targetType_targetId: {
          targetType,
          targetId,
        },
      },
      include: {
        lockedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * IDでロックを検索
   */
  async findById(id: string): Promise<EditLock | null> {
    return prisma.editLock.findUnique({
      where: { id },
      include: {
        lockedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * ロックを作成
   */
  async create(data: CreateEditLockData): Promise<EditLock> {
    return prisma.editLock.create({
      data: {
        targetType: data.targetType,
        targetId: data.targetId,
        lockedByUserId: data.lockedByUserId,
        expiresAt: data.expiresAt,
        lockedAt: new Date(),
        lastHeartbeat: new Date(),
      },
      include: {
        lockedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * ハートビートを更新
   */
  async updateHeartbeat(id: string, expiresAt: Date): Promise<EditLock> {
    return prisma.editLock.update({
      where: { id },
      data: {
        lastHeartbeat: new Date(),
        expiresAt,
      },
      include: {
        lockedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * ロックを削除
   */
  async delete(id: string): Promise<void> {
    await prisma.editLock.delete({
      where: { id },
    });
  }

  /**
   * 期限切れロックを検索
   */
  async findExpired(): Promise<EditLock[]> {
    return prisma.editLock.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
      include: {
        lockedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * 期限切れロックを一括削除
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.editLock.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    return result.count;
  }
}
