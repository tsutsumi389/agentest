import { prisma, type UserPlan } from '@agentest/db';

/**
 * ユーザーリポジトリ
 */
export class UserRepository {
  /**
   * IDでユーザーを検索
   */
  async findById(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
  }

  /**
   * メールでユーザーを検索
   */
  async findByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  /**
   * ユーザーを更新
   */
  async update(id: string, data: { name?: string; avatarUrl?: string | null }) {
    return prisma.user.update({
      where: { id },
      data,
    });
  }

  /**
   * ユーザーのプランを更新
   */
  async updatePlan(id: string, plan: UserPlan) {
    return prisma.user.update({
      where: { id },
      data: { plan },
    });
  }

  /**
   * ユーザーを論理削除
   */
  async softDelete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
