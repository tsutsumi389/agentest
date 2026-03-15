import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { NotificationType } from '@agentest/db';
import { NotificationService } from '../services/notification.service.js';

// NotificationTypeの値を配列として取得
// 注意: Prismaが生成するenumなので空になることはないが、
// TypeScriptの型チェックのため非空配列としてキャストしている
const notificationTypes = Object.values(NotificationType) as [string, ...string[]];

// バリデーションスキーマ
const getNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  unreadOnly: z.coerce.boolean().optional().default(false),
});

const updatePreferenceSchema = z.object({
  emailEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
});

/**
 * 通知コントローラー
 */
export class NotificationController {
  private notificationService = new NotificationService();

  /**
   * 通知一覧取得
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const params = getNotificationsSchema.parse(req.query);
      const notifications = await this.notificationService.getNotifications(req.user!.id, params);

      res.json({ notifications });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 未読数取得
   */
  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = await this.notificationService.getUnreadCount(req.user!.id);

      res.json({ count });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 通知を既読にする
   */
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const notification = await this.notificationService.markAsRead(req.user!.id, id);

      res.json({ notification });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 全ての通知を既読にする
   */
  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const count = await this.notificationService.markAllAsRead(req.user!.id);

      res.json({ updatedCount: count });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 通知を削除
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.notificationService.deleteNotification(req.user!.id, id);

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * 通知設定取得
   */
  getPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const preferences = await this.notificationService.getPreferences(req.user!.id);

      // 全ての通知タイプについてデフォルト値を含めて返す
      const allPreferences = notificationTypes.map((type) => {
        const existing = preferences.find((p) => p.type === type);
        return {
          type,
          emailEnabled: existing?.emailEnabled ?? true,
          inAppEnabled: existing?.inAppEnabled ?? true,
        };
      });

      res.json({ preferences: allPreferences });
    } catch (error) {
      next(error);
    }
  };

  /**
   * 通知設定更新
   */
  updatePreference = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { type } = req.params;
      const data = updatePreferenceSchema.parse(req.body);

      // typeのバリデーション
      if (!notificationTypes.includes(type as NotificationType)) {
        res.status(400).json({
          error: {
            code: 'INVALID_NOTIFICATION_TYPE',
            message: '無効な通知タイプです',
            statusCode: 400,
          },
        });
        return;
      }

      const preference = await this.notificationService.updatePreference(
        req.user!.id,
        type as NotificationType,
        data
      );

      res.json({ preference });
    } catch (error) {
      next(error);
    }
  };
}
