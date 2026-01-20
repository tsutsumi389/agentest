import type { NotificationType } from '@agentest/db';
import { prisma } from '@agentest/db';
import { NotFoundError, AuthorizationError } from '@agentest/shared';
import { NotificationRepository } from '../repositories/notification.repository.js';
import { emailService } from './email.service.js';
import { publishEvent } from '../lib/redis-publisher.js';
import { Channels } from '@agentest/ws-types';

/**
 * 通知送信パラメータ
 */
interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  organizationId?: string;
}

/**
 * 通知サービス
 */
export class NotificationService {
  private notificationRepo = new NotificationRepository();

  /**
   * 通知を送信
   * ユーザー設定と組織設定をチェックし、アプリ内通知とメール通知を行う
   * 組織設定が無効の場合は、ユーザー設定に関わらず通知をスキップ
   */
  async send(params: SendNotificationParams): Promise<void> {
    const { userId, type, title, body, data, organizationId } = params;

    // ユーザーの通知設定を取得
    const userPreference = await this.notificationRepo.getPreference(userId, type);
    let inAppEnabled = userPreference?.inAppEnabled ?? true;
    let emailEnabled = userPreference?.emailEnabled ?? true;

    // 組織設定をチェック（組織レベルで無効化されている場合はユーザー設定を上書き）
    if (organizationId) {
      const orgSetting = await this.notificationRepo.getOrganizationSetting(
        organizationId,
        type
      );
      if (orgSetting) {
        // 組織設定がfalseの場合、ユーザー設定に関わらず無効化
        if (!orgSetting.inAppEnabled) {
          inAppEnabled = false;
        }
        if (!orgSetting.emailEnabled) {
          emailEnabled = false;
        }
      }
    }

    // アプリ内通知
    if (inAppEnabled) {
      // DB保存
      const notification = await this.notificationRepo.create({
        userId,
        type,
        title,
        body,
        data,
      });

      // WebSocket経由でリアルタイム配信
      await this.sendWebSocketNotification(userId, {
        id: notification.id,
        type,
        title,
        body,
        data: data ?? null,
        createdAt: notification.createdAt.toISOString(),
      });
    }

    // メール通知（失敗してもアプリ内通知に影響しないようにする）
    if (emailEnabled) {
      try {
        await this.sendEmailNotification(userId, type, title, body, data);
      } catch (error) {
        // メール送信失敗はログに記録するが、アプリ内通知は既に完了しているため例外を投げない
        console.error('メール通知の送信に失敗しました:', error);
      }
    }
  }

  /**
   * WebSocketで通知を配信
   */
  private async sendWebSocketNotification(
    userId: string,
    notification: {
      id: string;
      type: NotificationType;
      title: string;
      body: string;
      data: Record<string, unknown> | null;
      createdAt: string;
    }
  ): Promise<void> {
    // ユーザー専用チャンネルに通知イベントを発行
    await publishEvent(Channels.user(userId), {
      type: 'notification:received',
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      notification,
    });

    // 未読数も更新
    const unreadCount = await this.notificationRepo.countUnread(userId);
    await publishEvent(Channels.user(userId), {
      type: 'notification:unread_count',
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      count: unreadCount,
    });
  }

  /**
   * メール通知を送信
   */
  private async sendEmailNotification(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    // ユーザーのメールアドレスを取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      return;
    }

    // テンプレートに基づいてメールを生成
    const { subject, text, html } = this.generateEmailContent(type, title, body, data, user.name);

    // メール送信
    await emailService.send({
      to: user.email,
      subject,
      text,
      html,
    });
  }

  /**
   * メール本文を生成
   */
  private generateEmailContent(
    _type: NotificationType,
    title: string,
    body: string,
    _data?: Record<string, unknown>,
    userName?: string
  ): { subject: string; text: string; html: string } {
    const greeting = userName ? `${userName}様` : 'ユーザー様';

    const text = `${greeting}

${title}

${body}

---
Agentest - テスト管理ツール
`;

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #6366f1; padding-bottom: 10px; margin-bottom: 20px; }
    .content { padding: 20px 0; }
    .footer { border-top: 1px solid #e5e5e5; padding-top: 20px; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="font-size: 24px; margin: 0;">Agentest</h1>
    </div>
    <div class="content">
      <p>${greeting}</p>
      <h2 style="font-size: 18px;">${title}</h2>
      <p>${body}</p>
    </div>
    <div class="footer">
      <p>Agentest - テスト管理ツール</p>
    </div>
  </div>
</body>
</html>
`;

    return {
      subject: `[Agentest] ${title}`,
      text,
      html,
    };
  }

  /**
   * ユーザーの通知一覧を取得
   */
  async getNotifications(
    userId: string,
    options: { limit?: number; offset?: number; unreadOnly?: boolean }
  ) {
    return this.notificationRepo.findByUserId(userId, options);
  }

  /**
   * 未読数を取得
   */
  async getUnreadCount(userId: string) {
    return this.notificationRepo.countUnread(userId);
  }

  /**
   * 通知を既読にする
   */
  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepo.findById(notificationId);

    if (!notification) {
      throw new NotFoundError('Notification', notificationId);
    }

    if (notification.userId !== userId) {
      throw new AuthorizationError('この通知へのアクセス権がありません');
    }

    const updated = await this.notificationRepo.markAsRead(notificationId);

    // 未読数を更新して通知
    const unreadCount = await this.notificationRepo.countUnread(userId);
    await publishEvent(Channels.user(userId), {
      type: 'notification:unread_count',
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      count: unreadCount,
    });

    return updated;
  }

  /**
   * 全ての通知を既読にする
   */
  async markAllAsRead(userId: string) {
    const count = await this.notificationRepo.markAllAsRead(userId);

    // 未読数をリセット
    await publishEvent(Channels.user(userId), {
      type: 'notification:unread_count',
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      count: 0,
    });

    return count;
  }

  /**
   * 通知を削除
   */
  async deleteNotification(userId: string, notificationId: string) {
    const notification = await this.notificationRepo.findById(notificationId);

    if (!notification) {
      throw new NotFoundError('Notification', notificationId);
    }

    if (notification.userId !== userId) {
      throw new AuthorizationError('この通知へのアクセス権がありません');
    }

    await this.notificationRepo.delete(notificationId);
  }

  /**
   * ユーザーの通知設定を取得
   */
  async getPreferences(userId: string) {
    return this.notificationRepo.getPreferences(userId);
  }

  /**
   * 通知設定を更新
   */
  async updatePreference(
    userId: string,
    type: NotificationType,
    data: { emailEnabled?: boolean; inAppEnabled?: boolean }
  ) {
    return this.notificationRepo.upsertPreference(userId, type, data);
  }
}

// シングルトンインスタンス
export const notificationService = new NotificationService();
