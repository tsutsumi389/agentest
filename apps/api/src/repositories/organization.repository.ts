import { prisma } from '@agentest/db';

/**
 * 組織リポジトリ
 */
export class OrganizationRepository {
  /**
   * IDで組織を検索
   */
  async findById(id: string) {
    return prisma.organization.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * 組織を更新
   */
  async update(id: string, data: { name?: string; description?: string | null }) {
    return prisma.organization.update({
      where: { id },
      data,
    });
  }

  /**
   * 組織を論理削除
   */
  async softDelete(id: string) {
    return prisma.organization.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * 削除済み組織をIDで検索
   */
  async findDeletedById(id: string) {
    return prisma.organization.findFirst({
      where: {
        id,
        deletedAt: { not: null },
      },
    });
  }

  /**
   * 組織を復元（deletedAtをnullに戻す）
   */
  async restore(id: string) {
    return prisma.organization.update({
      where: { id },
      data: { deletedAt: null },
    });
  }
}
