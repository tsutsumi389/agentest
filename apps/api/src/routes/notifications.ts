import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '@agentest/auth';
import { authConfig } from '../config/auth.js';

const router: Router = Router();
const notificationController = new NotificationController();

// 全てのエンドポイントで認証必須
router.use(requireAuth(authConfig));

// 通知一覧取得
router.get('/', notificationController.list);

// 未読数取得
router.get('/unread-count', notificationController.getUnreadCount);

// 通知設定取得
router.get('/preferences', notificationController.getPreferences);

// 通知設定更新
router.patch('/preferences/:type', notificationController.updatePreference);

// 全て既読にする
router.post('/mark-all-read', notificationController.markAllAsRead);

// 通知を既読にする
router.patch('/:id/read', notificationController.markAsRead);

// 通知を削除
router.delete('/:id', notificationController.delete);

export default router;
