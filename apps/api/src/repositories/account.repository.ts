import { prisma } from '@agentest/db';

/**
 * OAuth連携アカウントリポジトリ
 */
export class AccountRepository {
  /**
   * ユーザーのOAuth連携一覧を取得
   */
  async findByUserId(userId: string) {
    return prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        providerAccountId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * 特定のプロバイダー連携を取得
   */
  async findByUserIdAndProvider(userId: string, provider: string) {
    return prisma.account.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });
  }

  /**
   * ユーザーの連携数をカウント
   */
  async countByUserId(userId: string): Promise<number> {
    return prisma.account.count({
      where: { userId },
    });
  }

  /**
   * OAuth連携を削除
   */
  async delete(id: string) {
    return prisma.account.delete({
      where: { id },
    });
  }

  /**
   * プロバイダーとアカウントIDで連携を検索
   */
  async findByProviderAccountId(provider: string, providerAccountId: string) {
    return prisma.account.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
    });
  }
}
