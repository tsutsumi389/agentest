import { prisma } from '@agentest/db';

/**
 * セッションデータ作成用の型
 */
export interface CreateSessionData {
  userId: string;
  tokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}

/**
 * セッションリポジトリ
 */
export class SessionRepository {
  /**
   * セッションを作成
   */
  async create(data: CreateSessionData) {
    return prisma.session.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * トークンハッシュでセッションを取得
   */
  async findByTokenHash(tokenHash: string) {
    return prisma.session.findUnique({
      where: { tokenHash },
    });
  }

  /**
   * IDでセッションを取得
   */
  async findById(id: string) {
    return prisma.session.findUnique({
      where: { id },
    });
  }

  /**
   * ユーザーの有効なセッション一覧を取得
   */
  async findActiveByUserId(userId: string) {
    return prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastActiveAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /**
   * セッションの最終活動時刻を更新
   */
  async updateLastActiveAt(id: string) {
    return prisma.session.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * セッションを失効（ログアウト）
   */
  async revoke(id: string) {
    return prisma.session.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * トークンハッシュでセッションを失効
   */
  async revokeByTokenHash(tokenHash: string) {
    return prisma.session.updateMany({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * ユーザーの指定セッション以外を全て失効
   */
  async revokeAllExcept(userId: string, exceptSessionId: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        id: { not: exceptSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * ユーザーの全セッションを失効
   */
  async revokeAllByUserId(userId: string) {
    return prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 有効なセッション数をカウント
   */
  async countActiveByUserId(userId: string): Promise<number> {
    return prisma.session.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  /**
   * 期限切れセッションを削除（クリーンアップ用）
   */
  async deleteExpired() {
    return prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
    });
  }
}
