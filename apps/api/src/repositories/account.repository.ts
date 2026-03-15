import { prisma } from '@agentest/db';
import { env } from '../config/env.js';
import { decryptToken } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

/**
 * OAuth連携アカウントリポジトリ
 */
export class AccountRepository {
  /**
   * ユーザーのOAuth連携一覧を取得
   * ※ トークンは返さない（一覧表示用）
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
   * 特定のプロバイダー連携を取得（トークンを復号して返す）
   */
  async findByUserIdAndProvider(userId: string, provider: string) {
    const account = await prisma.account.findUnique({
      where: {
        userId_provider: { userId, provider },
      },
    });

    return account ? this.decryptAccountTokens(account) : null;
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
   * プロバイダーとアカウントIDで連携を検索（トークンを復号して返す）
   */
  async findByProviderAccountId(provider: string, providerAccountId: string) {
    const account = await prisma.account.findUnique({
      where: {
        provider_providerAccountId: { provider, providerAccountId },
      },
    });

    return account ? this.decryptAccountTokens(account) : null;
  }

  /**
   * アカウントのトークンを復号する
   * 各トークンを独立して復号し、一方の失敗が他方に影響しないようにする
   */
  private decryptAccountTokens<
    T extends { accessToken?: string | null; refreshToken?: string | null },
  >(account: T): T {
    const accountId = (account as Record<string, unknown>).id;
    let accessToken: string | null = null;
    let refreshToken: string | null = null;

    try {
      accessToken = decryptToken(account.accessToken, env.TOKEN_ENCRYPTION_KEY);
    } catch (error) {
      logger.warn(
        { error, accountId },
        'accessTokenの復号に失敗（データ改ざんまたはキー不整合の可能性）'
      );
    }

    try {
      refreshToken = decryptToken(account.refreshToken, env.TOKEN_ENCRYPTION_KEY);
    } catch (error) {
      logger.warn(
        { error, accountId },
        'refreshTokenの復号に失敗（データ改ざんまたはキー不整合の可能性）'
      );
    }

    return { ...account, accessToken, refreshToken };
  }
}
