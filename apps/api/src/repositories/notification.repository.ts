import { prisma, Prisma } from '@agentest/db';
import type { NotificationType } from '@agentest/db';

/**
 * 通知リポジトリ
 */
export class NotificationRepository {
  /**
   * 通知を作成
   */
  async create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /**
   * ユーザーの通知一覧を取得
   */
  async findByUserId(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean }
  ) {
    const { limit = 20, offset = 0, unreadOnly = false } = options;

    return prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { readAt: null }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * 未読数を取得
   */
  async countUnread(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  /**
   * 通知を既読にする
   */
  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  /**
   * 全ての通知を既読にする
   */
  async markAllAsRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  /**
   * 通知を削除
   */
  async delete(id: string) {
    return prisma.notification.delete({
      where: { id },
    });
  }

  /**
   * IDで通知を取得
   */
  async findById(id: string) {
    return prisma.notification.findUnique({
      where: { id },
    });
  }

  /**
   * ユーザーの通知設定を取得
   */
  async getPreferences(userId: string) {
    return prisma.notificationPreference.findMany({
      where: { userId },
    });
  }

  /**
   * 特定の通知タイプの設定を取得
   */
  async getPreference(userId: string, type: NotificationType) {
    return prisma.notificationPreference.findUnique({
      where: {
        userId_type: { userId, type },
      },
    });
  }

  /**
   * 通知設定を作成または更新
   */
  async upsertPreference(
    userId: string,
    type: NotificationType,
    data: { emailEnabled?: boolean; inAppEnabled?: boolean }
  ) {
    return prisma.notificationPreference.upsert({
      where: {
        userId_type: { userId, type },
      },
      update: data,
      create: {
        userId,
        type,
        emailEnabled: data.emailEnabled ?? true,
        inAppEnabled: data.inAppEnabled ?? true,
      },
    });
  }

  /**
   * 組織の通知設定を取得
   */
  async getOrganizationSettings(organizationId: string) {
    return prisma.organizationNotificationSetting.findMany({
      where: { organizationId },
    });
  }

  /**
   * 特定の通知タイプの組織設定を取得
   */
  async getOrganizationSetting(organizationId: string, type: NotificationType) {
    return prisma.organizationNotificationSetting.findUnique({
      where: {
        organizationId_type: { organizationId, type },
      },
    });
  }

  /**
   * メール送信日時を記録
   */
  async markEmailSent(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { emailSentAt: new Date() },
    });
  }
}
