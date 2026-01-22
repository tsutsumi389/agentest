import { prisma } from '@agentest/db';

/**
 * 管理者セッション作成用の型
 */
export interface CreateAdminSessionData {
  adminUserId: string;
  token: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
}

/**
 * 管理者セッションリポジトリ
 */
export class AdminSessionRepository {
  /**
   * セッションを作成
   */
  async create(data: CreateAdminSessionData) {
    return prisma.adminSession.create({
      data: {
        adminUserId: data.adminUserId,
        token: data.token,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * トークンでセッションを取得（管理者ユーザーを含む）
   */
  async findByToken(token: string) {
    return prisma.adminSession.findUnique({
      where: { token },
      include: {
        adminUser: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            totpEnabled: true,
            deletedAt: true,
          },
        },
      },
    });
  }

  /**
   * IDでセッションを取得
   */
  async findById(id: string) {
    return prisma.adminSession.findUnique({
      where: { id },
    });
  }

  /**
   * セッションの最終活動時刻を更新
   */
  async updateLastActiveAt(id: string) {
    return prisma.adminSession.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  /**
   * セッションの有効期限を延長
   */
  async extendExpiry(id: string, newExpiresAt: Date) {
    return prisma.adminSession.update({
      where: { id },
      data: { expiresAt: newExpiresAt },
    });
  }

  /**
   * セッションを失効（ログアウト）
   */
  async revoke(id: string) {
    return prisma.adminSession.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * トークンでセッションを失効
   */
  async revokeByToken(token: string) {
    return prisma.adminSession.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 管理者の全セッションを失効
   */
  async revokeAllByUserId(adminUserId: string) {
    return prisma.adminSession.updateMany({
      where: {
        adminUserId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 期限切れセッションを削除（クリーンアップ用）
   */
  async deleteExpired() {
    return prisma.adminSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { not: null } },
        ],
      },
    });
  }
}
