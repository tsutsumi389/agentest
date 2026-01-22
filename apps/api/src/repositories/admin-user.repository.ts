import { prisma } from '@agentest/db';

/**
 * 管理者ユーザーリポジトリ
 */
export class AdminUserRepository {
  /**
   * メールアドレスで管理者を検索（パスワードハッシュ含む）
   */
  async findByEmailWithPassword(email: string) {
    return prisma.adminUser.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  /**
   * IDで管理者を検索（パスワードなし）
   */
  async findById(id: string) {
    return prisma.adminUser.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        totpEnabled: true,
        failedAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * ログイン失敗回数をインクリメント
   * @returns 更新後の failedAttempts を含むオブジェクト
   */
  async incrementFailedAttempts(id: string) {
    return prisma.adminUser.update({
      where: { id },
      data: {
        failedAttempts: { increment: 1 },
      },
      select: {
        id: true,
        failedAttempts: true,
      },
    });
  }

  /**
   * アカウントをロック
   */
  async lockAccount(id: string, until: Date) {
    return prisma.adminUser.update({
      where: { id },
      data: {
        lockedUntil: until,
      },
    });
  }

  /**
   * ログイン成功時に失敗回数とロックをリセット
   */
  async resetFailedAttempts(id: string) {
    return prisma.adminUser.update({
      where: { id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
  }
}
