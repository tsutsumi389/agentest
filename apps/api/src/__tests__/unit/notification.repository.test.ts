import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationRepository } from '../../repositories/notification.repository.js';

// Prisma のモック
const mockPrismaNotification = vi.hoisted(() => ({
  create: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  delete: vi.fn(),
}));

const mockPrismaNotificationPreference = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

const mockPrismaOrgNotificationSetting = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    notification: mockPrismaNotification,
    notificationPreference: mockPrismaNotificationPreference,
    organizationNotificationSetting: mockPrismaOrgNotificationSetting,
  },
}));

describe('NotificationRepository', () => {
  let repository: NotificationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new NotificationRepository();
  });

  describe('create', () => {
    it('通知を作成できる', async () => {
      const mockNotification = {
        id: 'notif-1',
        userId: 'user-1',
        type: 'ORG_INVITATION',
        title: 'テスト通知',
        body: '本文',
        data: null,
        readAt: null,
        emailSentAt: null,
        createdAt: new Date(),
      };
      mockPrismaNotification.create.mockResolvedValue(mockNotification);

      const result = await repository.create({
        userId: 'user-1',
        type: 'ORG_INVITATION',
        title: 'テスト通知',
        body: '本文',
      });

      expect(mockPrismaNotification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: 'ORG_INVITATION',
          title: 'テスト通知',
          body: '本文',
          data: undefined,
        },
      });
      expect(result).toEqual(mockNotification);
    });
  });

  describe('findByUserId', () => {
    it('ユーザーの通知一覧を取得できる', async () => {
      const mockNotifications = [
        { id: 'notif-1', title: '通知1' },
        { id: 'notif-2', title: '通知2' },
      ];
      mockPrismaNotification.findMany.mockResolvedValue(mockNotifications);

      const result = await repository.findByUserId('user-1', {});

      expect(mockPrismaNotification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
      expect(result).toEqual(mockNotifications);
    });

    it('未読のみ取得できる', async () => {
      mockPrismaNotification.findMany.mockResolvedValue([]);

      await repository.findByUserId('user-1', { unreadOnly: true });

      expect(mockPrismaNotification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', readAt: null },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });
  });

  describe('countUnread', () => {
    it('未読数を取得できる', async () => {
      mockPrismaNotification.count.mockResolvedValue(5);

      const result = await repository.countUnread('user-1');

      expect(mockPrismaNotification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          readAt: null,
        },
      });
      expect(result).toBe(5);
    });
  });

  describe('markAsRead', () => {
    it('通知を既読にできる', async () => {
      const mockNotification = { id: 'notif-1', readAt: new Date() };
      mockPrismaNotification.update.mockResolvedValue(mockNotification);

      const result = await repository.markAsRead('notif-1');

      expect(mockPrismaNotification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toEqual(mockNotification);
    });
  });

  describe('markAllAsRead', () => {
    it('全ての通知を既読にできる', async () => {
      mockPrismaNotification.updateMany.mockResolvedValue({ count: 3 });

      const result = await repository.markAllAsRead('user-1');

      expect(mockPrismaNotification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          readAt: null,
        },
        data: { readAt: expect.any(Date) },
      });
      expect(result).toBe(3);
    });
  });

  describe('delete', () => {
    it('通知を削除できる', async () => {
      mockPrismaNotification.delete.mockResolvedValue({ id: 'notif-1' });

      await repository.delete('notif-1');

      expect(mockPrismaNotification.delete).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
    });
  });

  describe('getPreferences', () => {
    it('ユーザーの通知設定を取得できる', async () => {
      const mockPreferences = [{ type: 'ORG_INVITATION', emailEnabled: true, inAppEnabled: true }];
      mockPrismaNotificationPreference.findMany.mockResolvedValue(mockPreferences);

      const result = await repository.getPreferences('user-1');

      expect(mockPrismaNotificationPreference.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual(mockPreferences);
    });
  });

  describe('upsertPreference', () => {
    it('通知設定を更新できる', async () => {
      const mockPreference = {
        userId: 'user-1',
        type: 'ORG_INVITATION',
        emailEnabled: false,
        inAppEnabled: true,
      };
      mockPrismaNotificationPreference.upsert.mockResolvedValue(mockPreference);

      const result = await repository.upsertPreference('user-1', 'ORG_INVITATION', {
        emailEnabled: false,
      });

      expect(mockPrismaNotificationPreference.upsert).toHaveBeenCalled();
      expect(result).toEqual(mockPreference);
    });
  });
});
