import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, AuthorizationError } from '@agentest/shared';

// ロガーのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

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

const mockEmailService = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../../services/email.service.js', () => ({
  emailService: mockEmailService,
}));

vi.mock('../../lib/redis-publisher.js', () => ({
  publishEvent: mockPublishEvent,
}));

const mockPrismaUser = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@agentest/db', () => ({
  prisma: {
    user: mockPrismaUser,
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
      mockNotificationRepo.markAsRead.mockResolvedValue({
        ...mockNotification,
        readAt: new Date(),
      });
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

      await expect(service.deleteNotification('user-1', 'notif-1')).rejects.toThrow(
        AuthorizationError
      );
    });
  });

  describe('getPreferences', () => {
    it('通知設定を取得できる', async () => {
      const mockPreferences = [{ type: 'ORG_INVITATION', emailEnabled: true, inAppEnabled: true }];
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

  describe('send', () => {
    const baseSendParams = {
      userId: 'user-1',
      type: 'ORG_INVITATION' as const,
      title: 'テスト通知',
      body: 'テスト本文',
    };

    beforeEach(() => {
      // デフォルトのモック設定
      mockNotificationRepo.getPreference.mockResolvedValue(null); // デフォルト設定を使用
      mockNotificationRepo.getOrganizationSetting.mockResolvedValue(null);
      mockNotificationRepo.create.mockResolvedValue({
        id: 'notif-1',
        ...baseSendParams,
        createdAt: new Date(),
      });
      mockNotificationRepo.countUnread.mockResolvedValue(1);
      mockPrismaUser.findUnique.mockResolvedValue({
        email: 'user@example.com',
        name: 'Test User',
      });
      mockEmailService.send.mockResolvedValue(undefined);
      mockPublishEvent.mockResolvedValue(undefined);
    });

    it('通知を送信できる（アプリ内通知とメール）', async () => {
      await service.send(baseSendParams);

      // アプリ内通知が作成される
      expect(mockNotificationRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        type: 'ORG_INVITATION',
        title: 'テスト通知',
        body: 'テスト本文',
        data: undefined,
      });

      // WebSocket通知が発行される
      expect(mockPublishEvent).toHaveBeenCalled();

      // メールが送信される
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('ユーザー設定でアプリ内通知が無効の場合、通知を作成しない', async () => {
      mockNotificationRepo.getPreference.mockResolvedValue({
        inAppEnabled: false,
        emailEnabled: true,
      });

      await service.send(baseSendParams);

      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('ユーザー設定でメール通知が無効の場合、メールを送信しない', async () => {
      mockNotificationRepo.getPreference.mockResolvedValue({
        inAppEnabled: true,
        emailEnabled: false,
      });

      await service.send(baseSendParams);

      expect(mockNotificationRepo.create).toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('組織設定でアプリ内通知が無効の場合、ユーザー設定に関わらず通知を作成しない', async () => {
      mockNotificationRepo.getPreference.mockResolvedValue({
        inAppEnabled: true,
        emailEnabled: true,
      });
      mockNotificationRepo.getOrganizationSetting.mockResolvedValue({
        inAppEnabled: false,
        emailEnabled: true,
      });

      await service.send({ ...baseSendParams, organizationId: 'org-1' });

      expect(mockNotificationRepo.create).not.toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('組織設定でメール通知が無効の場合、ユーザー設定に関わらずメールを送信しない', async () => {
      mockNotificationRepo.getPreference.mockResolvedValue({
        inAppEnabled: true,
        emailEnabled: true,
      });
      mockNotificationRepo.getOrganizationSetting.mockResolvedValue({
        inAppEnabled: true,
        emailEnabled: false,
      });

      await service.send({ ...baseSendParams, organizationId: 'org-1' });

      expect(mockNotificationRepo.create).toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('メール送信に失敗してもアプリ内通知は成功する', async () => {
      mockEmailService.send.mockRejectedValue(new Error('SMTP error'));

      // エラーが投げられないことを確認
      await expect(service.send(baseSendParams)).resolves.not.toThrow();

      // アプリ内通知は作成される
      expect(mockNotificationRepo.create).toHaveBeenCalled();

      // エラーがログに記録される
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'メール通知の送信に失敗しました'
      );
    });

    it('ユーザーが見つからない場合、メールを送信しない', async () => {
      mockPrismaUser.findUnique.mockResolvedValue(null);

      await service.send(baseSendParams);

      expect(mockNotificationRepo.create).toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('HTMLの特殊文字をエスケープしてXSSを防止する', async () => {
      mockPrismaUser.findUnique.mockResolvedValue({
        email: 'user@example.com',
        name: '<script>alert("xss")</script>',
      });

      await service.send({
        ...baseSendParams,
        title: '"><img src=x onerror=alert(1)>',
        body: '<b onmouseover=alert(1)>悪意あるテキスト</b>',
      });

      const emailCall = mockEmailService.send.mock.calls[0]?.[0];
      expect(emailCall).toBeDefined();

      // HTML部分ではタグとして解釈されないようエスケープされている
      expect(emailCall.html).not.toContain('<script>');
      expect(emailCall.html).not.toContain('<img ');
      expect(emailCall.html).not.toContain('<b ');
      expect(emailCall.html).toContain('&lt;script&gt;');
      expect(emailCall.html).toContain('&lt;img src=x onerror=alert(1)&gt;');

      // テキスト部分はエスケープ不要（プレーンテキスト）
      expect(emailCall.text).toContain('<script>alert("xss")</script>');
    });

    it('subjectの改行文字を除去してSMTPヘッダーインジェクションを防止する', async () => {
      await service.send({
        ...baseSendParams,
        title: 'テスト\r\nBcc: attacker@evil.com',
      });

      const emailCall = mockEmailService.send.mock.calls[0]?.[0];
      expect(emailCall).toBeDefined();

      // 改行文字が除去されている
      expect(emailCall.subject).not.toContain('\r');
      expect(emailCall.subject).not.toContain('\n');
      expect(emailCall.subject).toBe('[Agentest] テストBcc: attacker@evil.com');
    });
  });
});
