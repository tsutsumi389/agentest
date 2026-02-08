import { prisma } from '@agentest/db';

/**
 * 管理者セッション作成用の型
 */
export interface CreateAdminSessionData {
  adminUserId: string;
  tokenHash: string;
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
        tokenHash: data.tokenHash,
        userAgent: data.userAgent,
        ipAddress: data.ipAddress,
        expiresAt: data.expiresAt,
      },
    });
  }

  /**
   * トークンハッシュでセッションを取得（管理者ユーザーを含む）
   */
  async findByTokenHash(tokenHash: string) {
    return prisma.adminSession.findUnique({
      where: { tokenHash },
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
   * トークンハッシュでセッションを失効
   */
  async revokeByTokenHash(tokenHash: string) {
    return prisma.adminSession.updateMany({
      where: { tokenHash },
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
   * 監査目的で30日間保持後に削除
   */
  async deleteExpired() {
    const retentionDays = 30;
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - retentionDays);

    return prisma.adminSession.deleteMany({
      where: {
        OR: [
          // 期限切れかつ保持期間を超過したセッション
          { expiresAt: { lt: retentionDate } },
          // 失効かつ保持期間を超過したセッション
          {
            revokedAt: {
              not: null,
              lt: retentionDate,
            },
          },
        ],
      },
    });
  }
}
