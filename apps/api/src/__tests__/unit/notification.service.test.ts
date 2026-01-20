import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError } from '@agentest/shared';

// モックをホイスティング
const mockNotificationRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findById: vi.fn(),
  findByUserId: vi.fn(),
  countUnread: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  delete: vi.fn(),
  getPreferences: vi.fn(),
  getPreference: vi.fn(),
  upsertPreference: vi.fn(),
  getOrganizationSetting: vi.fn(),
}));

const mockPublishEvent = vi.hoisted(() => vi.fn());

vi.mock('../../repositories/notification.repository.js', () => ({
  NotificationRepository: vi.fn().mockImplementation(() => mockNotificationRepo),
}));

vi.mock('../../services/email.service.js', () => ({
  emailService: {
    send: vi.fn(),
  },
}));

vi.mock('../../lib/redis-publisher.js', () => ({
  publishEvent: mockPublishEvent,
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@agentest/ws-types', () => ({
  Channels: {
    user: (userId: string) => `user:${userId}`,
  },
}));

// インポートはモック後に行う
import { NotificationService } from '../../services/notification.service.js';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService();
  });

  describe('getNotifications', () => {
    it('ユーザーの通知一覧を取得できる', async () => {
      const mockNotifications = [
        { id: 'notif-1', title: '通知1' },
        { id: 'notif-2', title: '通知2' },
      ];
      mockNotificationRepo.findByUserId.mockResolvedValue(mockNotifications);

      const result = await service.getNotifications('user-1', {});

      expect(mockNotificationRepo.findByUserId).toHaveBeenCalledWith('user-1', {});
      expect(result).toEqual(mockNotifications);
    });
  });

  describe('getUnreadCount', () => {
    it('未読数を取得できる', async () => {
      mockNotificationRepo.countUnread.mockResolvedValue(5);

      const result = await service.getUnreadCount('user-1');

      expect(mockNotificationRepo.countUnread).toHaveBeenCalledWith('user-1');
      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('通知を既読にできる', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        readAt: null,
      };
      mockNotificationRepo.findById.mockResolvedValue(mockNotification);
      mockNotificationRepo.markAsRead.mockResolvedValue({ ...mockNotification, readAt: new Date() });
      mockNotificationRepo.countUnread.mockResolvedValue(4);

      const result = await service.markAsRead('user-1', 'notif-1');

      expect(mockNotificationRepo.findById).toHaveBeenCalledWith('notif-1');
      expect(mockNotificationRepo.markAsRead).toHaveBeenCalledWith('notif-1');
      expect(result.readAt).toBeDefined();
    });

    it('存在しない通知はエラー', async () => {
      mockNotificationRepo.findById.mockResolvedValue(null);

      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(NotFoundError);
    });

    it('他ユーザーの通知は既読にできない', async () => {
      mockNotificationRepo.findById.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
        readAt: null,
      });

      await expect(service.markAsRead('user-1', 'notif-1')).rejects.toThrow(AuthorizationError);
    });
  });

  describe('markAllAsRead', () => {
    it('全ての通知を既読にできる', async () => {
      mockNotificationRepo.markAllAsRead.mockResolvedValue(3);

      const result = await service.markAllAsRead('user-1');

      expect(mockNotificationRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
      expect(result).toBe(3);
    });
  });

  describe('deleteNotification', () => {
    it('通知を削除できる', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
      };
      mockNotificationRepo.findById.mockResolvedValue(mockNotification);
      mockNotificationRepo.delete.mockResolvedValue(undefined);

      await service.deleteNotification('user-1', 'notif-1');

      expect(mockNotificationRepo.delete).toHaveBeenCalledWith('notif-1');
    });

    it('他ユーザーの通知は削除できない', async () => {
      mockNotificationRepo.findById.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
      });

      await expect(service.deleteNotification('user-1', 'notif-1')).rejects.toThrow(AuthorizationError);
    });
  });

  describe('getPreferences', () => {
    it('通知設定を取得できる', async () => {
      const mockPreferences = [
        { type: 'ORG_INVITATION', emailEnabled: true, inAppEnabled: true },
      ];
      mockNotificationRepo.getPreferences.mockResolvedValue(mockPreferences);

      const result = await service.getPreferences('user-1');

      expect(mockNotificationRepo.getPreferences).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('updatePreference', () => {
    it('通知設定を更新できる', async () => {
      const mockPreference = {
        userId: 'user-1',
        type: 'ORG_INVITATION',
        emailEnabled: false,
        inAppEnabled: true,
      };
      mockNotificationRepo.upsertPreference.mockResolvedValue(mockPreference);

      const result = await service.updatePreference('user-1', 'ORG_INVITATION', {
        emailEnabled: false,
      });

      expect(mockNotificationRepo.upsertPreference).toHaveBeenCalledWith(
        'user-1',
        'ORG_INVITATION',
        { emailEnabled: false }
      );
      expect(result).toEqual(mockPreference);
    });
  });
});
