import { prisma, type ChangeType, type Prisma } from '@agentest/db';

/**
 * プロジェクトリポジトリ
 */
export class ProjectRepository {
  /**
   * IDでプロジェクトを検索
   */
  async findById(id: string) {
    return prisma.project.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * 削除済みプロジェクトをIDで検索
   */
  async findDeletedById(id: string) {
    return prisma.project.findFirst({
      where: {
        id,
        deletedAt: { not: null },
      },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * プロジェクトを更新
   */
  async update(id: string, data: { name?: string; description?: string | null }) {
    return prisma.project.update({
      where: { id },
      data,
    });
  }

  /**
   * プロジェクトを論理削除
   */
  async softDelete(id: string) {
    return prisma.project.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * プロジェクトを復元
   */
  async restore(id: string) {
    return prisma.project.update({
      where: { id },
      data: { deletedAt: null },
      include: {
        organization: {
          select: { id: true, name: true, slug: true },
        },
        owner: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
  }

  /**
   * 履歴を作成
   */
  async createHistory(data: {
    projectId: string;
    changedByUserId?: string;
    changedByAgentSessionId?: string;
    changeType: ChangeType;
    snapshot: Prisma.InputJsonValue;
    changeReason?: string;
  }) {
    return prisma.projectHistory.create({
      data,
    });
  }

  /**
   * 履歴一覧を取得
   */
  async getHistories(projectId: string, options?: { limit?: number; offset?: number }) {
    return prisma.projectHistory.findMany({
      where: { projectId },
      include: {
        changedBy: {
          select: { id: true, name: true, avatarUrl: true },
        },
        agentSession: {
          select: { id: true, clientName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }
}
