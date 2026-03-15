import { prisma } from '@agentest/db';

/**
 * APIトークンリポジトリ
 * APIキー認証に使用するトークンのDB操作を担当
 */
export class ApiTokenRepository {
  /**
   * トークンハッシュからAPIトークンを検索
   * 有効なトークン（失効していない、有効期限内）のみを返す
   */
  async findByHash(tokenHash: string) {
    return prisma.apiToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        user: {
          select: { id: true, email: true, name: true, deletedAt: true },
        },
        organization: {
          select: { id: true, name: true, deletedAt: true },
        },
      },
    });
  }

  /**
   * 最終使用日時を更新
   */
  async updateLastUsedAt(id: string) {
    return prisma.apiToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  /**
   * APIトークンを作成
   */
  async create(data: {
    userId?: string;
    organizationId?: string;
    name: string;
    tokenHash: string;
    tokenPrefix: string;
    scopes: string[];
    expiresAt?: Date;
  }) {
    return prisma.apiToken.create({
      data,
    });
  }

  /**
   * APIトークンを失効させる
   */
  async revoke(id: string) {
    return prisma.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * ユーザーのAPIトークン一覧を取得（失効済み含む）
   */
  async findByUserId(userId: string) {
    return prisma.apiToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 組織のAPIトークン一覧を取得（失効済み含む）
   */
  async findByOrganizationId(organizationId: string) {
    return prisma.apiToken.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * IDでAPIトークンを取得
   */
  async findById(id: string) {
    return prisma.apiToken.findUnique({
      where: { id },
    });
  }
}
