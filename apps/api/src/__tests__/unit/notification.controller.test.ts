import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// NotificationService のモック
const mockNotificationService = vi.hoisted(() => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  getPreferences: vi.fn(),
  updatePreference: vi.fn(),
}));

vi.mock('../../services/notification.service.js', () => ({
  NotificationService: vi.fn().mockImplementation(() => mockNotificationService),
}));

// NotificationType のモック
vi.mock('@agentest/db', () => ({
  NotificationType: {
    REVIEW_REQUESTED: 'REVIEW_REQUESTED',
    REVIEW_COMPLETED: 'REVIEW_COMPLETED',
    COMMENT_ADDED: 'COMMENT_ADDED',
    EXECUTION_COMPLETED: 'EXECUTION_COMPLETED',
  },
}));

import { NotificationController } from '../../controllers/notification.controller.js';

// テスト用の固定値
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
const TEST_NOTIFICATION_ID = '22222222-2222-2222-2222-222222222222';

// Express のモック
const mockRequest = (overrides = {}): Partial<Request> => ({
  user: { id: TEST_USER_ID } as Request['user'],
  params: {},
  body: {},
  query: {},
  ...overrides,
});

const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('NotificationController', () => {
  let controller: NotificationController;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new NotificationController();
    mockNext = vi.fn();
  });

  describe('list', () => {
    it('通知一覧を取得できる', async () => {
      const mockNotifications = [
        { id: TEST_NOTIFICATION_ID, message: 'テスト通知' },
      ];
      mockNotificationService.getNotifications.mockResolvedValue(mockNotifications);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.list(req, res, mockNext);

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        TEST_USER_ID,
        { limit: 20, offset: 0, unreadOnly: false }
      );
      expect(res.json).toHaveBeenCalledWith({ notifications: mockNotifications });
    });

    it('クエリパラメータが正しくパースされる', async () => {
      const mockNotifications = [];
      mockNotificationService.getNotifications.mockResolvedValue(mockNotifications);

      const req = mockRequest({
        query: { limit: '50', offset: '10', unreadOnly: 'true' },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.list(req, res, mockNext);

      expect(mockNotificationService.getNotifications).toHaveBeenCalledWith(
        TEST_USER_ID,
        { limit: 50, offset: 10, unreadOnly: true }
      );
      expect(res.json).toHaveBeenCalledWith({ notifications: mockNotifications });
    });

    it('エラーをnextに渡す', async () => {
      const error = new Error('取得エラー');
      mockNotificationService.getNotifications.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.list(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getUnreadCount', () => {
    it('未読数を取得できる', async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(5);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getUnreadCount(req, res, mockNext);

      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ count: 5 });
    });

    it('エラーをnextに渡す', async () => {
      const error = new Error('未読数取得エラー');
      mockNotificationService.getUnreadCount.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getUnreadCount(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('markAsRead', () => {
    it('通知を既読にできる', async () => {
      const mockNotification = {
        id: TEST_NOTIFICATION_ID,
        readAt: new Date(),
      };
      mockNotificationService.markAsRead.mockResolvedValue(mockNotification);

      const req = mockRequest({
        params: { id: TEST_NOTIFICATION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.markAsRead(req, res, mockNext);

      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_NOTIFICATION_ID
      );
      expect(res.json).toHaveBeenCalledWith({ notification: mockNotification });
    });

    it('エラーをnextに渡す', async () => {
      const error = new Error('既読更新エラー');
      mockNotificationService.markAsRead.mockRejectedValue(error);

      const req = mockRequest({
        params: { id: TEST_NOTIFICATION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.markAsRead(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('markAllAsRead', () => {
    it('全ての通知を既読にできる', async () => {
      mockNotificationService.markAllAsRead.mockResolvedValue(3);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.markAllAsRead(req, res, mockNext);

      expect(mockNotificationService.markAllAsRead).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({ updatedCount: 3 });
    });

    it('エラーをnextに渡す', async () => {
      const error = new Error('一括既読エラー');
      mockNotificationService.markAllAsRead.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.markAllAsRead(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('delete', () => {
    it('通知を削除して204を返す', async () => {
      mockNotificationService.deleteNotification.mockResolvedValue(undefined);

      const req = mockRequest({
        params: { id: TEST_NOTIFICATION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockNotificationService.deleteNotification).toHaveBeenCalledWith(
        TEST_USER_ID,
        TEST_NOTIFICATION_ID
      );
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('エラーをnextに渡す', async () => {
      const error = new Error('削除エラー');
      mockNotificationService.deleteNotification.mockRejectedValue(error);

      const req = mockRequest({
        params: { id: TEST_NOTIFICATION_ID },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.delete(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getPreferences', () => {
    it('既存の設定とデフォルト値をマージして返す', async () => {
      // 一部の通知タイプのみ設定が存在するケース
      const existingPreferences = [
        { type: 'REVIEW_REQUESTED', emailEnabled: false, inAppEnabled: true },
        { type: 'COMMENT_ADDED', emailEnabled: true, inAppEnabled: false },
      ];
      mockNotificationService.getPreferences.mockResolvedValue(existingPreferences);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPreferences(req, res, mockNext);

      expect(mockNotificationService.getPreferences).toHaveBeenCalledWith(TEST_USER_ID);
      expect(res.json).toHaveBeenCalledWith({
        preferences: [
          // REVIEW_REQUESTED: 既存の設定を使用
          { type: 'REVIEW_REQUESTED', emailEnabled: false, inAppEnabled: true },
          // REVIEW_COMPLETED: デフォルト値（両方true）
          { type: 'REVIEW_COMPLETED', emailEnabled: true, inAppEnabled: true },
          // COMMENT_ADDED: 既存の設定を使用
          { type: 'COMMENT_ADDED', emailEnabled: true, inAppEnabled: false },
          // EXECUTION_COMPLETED: デフォルト値（両方true）
          { type: 'EXECUTION_COMPLETED', emailEnabled: true, inAppEnabled: true },
        ],
      });
    });

    it('設定が空の場合は全てデフォルト値を返す', async () => {
      // 設定が一切存在しないケース
      mockNotificationService.getPreferences.mockResolvedValue([]);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPreferences(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        preferences: [
          { type: 'REVIEW_REQUESTED', emailEnabled: true, inAppEnabled: true },
          { type: 'REVIEW_COMPLETED', emailEnabled: true, inAppEnabled: true },
          { type: 'COMMENT_ADDED', emailEnabled: true, inAppEnabled: true },
          { type: 'EXECUTION_COMPLETED', emailEnabled: true, inAppEnabled: true },
        ],
      });
    });

    it('エラーをnextに渡す', async () => {
      const error = new Error('設定取得エラー');
      mockNotificationService.getPreferences.mockRejectedValue(error);

      const req = mockRequest() as Request;
      const res = mockResponse() as Response;

      await controller.getPreferences(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('updatePreference', () => {
    it('通知設定を更新できる', async () => {
      const mockPreference = {
        type: 'REVIEW_REQUESTED',
        emailEnabled: false,
        inAppEnabled: true,
      };
      mockNotificationService.updatePreference.mockResolvedValue(mockPreference);

      const req = mockRequest({
        params: { type: 'REVIEW_REQUESTED' },
        body: { emailEnabled: false, inAppEnabled: true },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updatePreference(req, res, mockNext);

      expect(mockNotificationService.updatePreference).toHaveBeenCalledWith(
        TEST_USER_ID,
        'REVIEW_REQUESTED',
        { emailEnabled: false, inAppEnabled: true }
      );
      expect(res.json).toHaveBeenCalledWith({ preference: mockPreference });
    });

    it('一部のフィールドのみ更新できる', async () => {
      // emailEnabledのみ指定するケース
      const mockPreference = {
        type: 'COMMENT_ADDED',
        emailEnabled: false,
        inAppEnabled: true,
      };
      mockNotificationService.updatePreference.mockResolvedValue(mockPreference);

      const req = mockRequest({
        params: { type: 'COMMENT_ADDED' },
        body: { emailEnabled: false },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updatePreference(req, res, mockNext);

      expect(mockNotificationService.updatePreference).toHaveBeenCalledWith(
        TEST_USER_ID,
        'COMMENT_ADDED',
        { emailEnabled: false }
      );
      expect(res.json).toHaveBeenCalledWith({ preference: mockPreference });
    });

    it('無効な通知タイプの場合は400を返す', async () => {
      const req = mockRequest({
        params: { type: 'INVALID_TYPE' },
        body: { emailEnabled: true },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updatePreference(req, res, mockNext);

      expect(mockNotificationService.updatePreference).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_NOTIFICATION_TYPE',
          message: '無効な通知タイプです',
          statusCode: 400,
        },
      });
    });

    it('エラーをnextに渡す', async () => {
      const error = new Error('設定更新エラー');
      mockNotificationService.updatePreference.mockRejectedValue(error);

      const req = mockRequest({
        params: { type: 'REVIEW_REQUESTED' },
        body: { emailEnabled: true },
      }) as Request;
      const res = mockResponse() as Response;

      await controller.updatePreference(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});
