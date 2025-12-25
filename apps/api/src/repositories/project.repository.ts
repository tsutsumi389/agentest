import { prisma } from '@agentest/db';

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
}
