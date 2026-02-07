import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNotificationStore } from '../notification';
import {
  createMockNotification,
  createMockNotificationPreference,
  DEFAULT_NOTIFICATION_LIMIT,
} from '../../__tests__/factories';

// APIモジュールをモック
vi.mock('../../lib/api', () => ({
  notificationsApi: {
    list: vi.fn(),
    getUnreadCount: vi.fn(),
    getPreferences: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    delete: vi.fn(),
    updatePreference: vi.fn(),
  },
}));

// モックをインポート
import { notificationsApi } from '../../lib/api';
const mockApi = vi.mocked(notificationsApi);

describe('notification store', () => {
  beforeEach(() => {
    useNotificationStore.getState().reset();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初期状態', () => {
    it('初期状態が正しい', () => {
      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.preferences).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.isLoadingMore).toBe(false);
      expect(state.hasMore).toBe(true);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchNotifications', () => {
    it('通知一覧を取得して状態を更新する', async () => {
      const mockNotifications = [
        createMockNotification({ id: 'n-1', title: '通知1', body: '本文1' }),
        createMockNotification({ id: 'n-2', title: '通知2', body: '本文2' }),
      ];
      mockApi.list.mockResolvedValue({ notifications: mockNotifications });

      await useNotificationStore.getState().fetchNotifications();

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual(mockNotifications);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it(`${DEFAULT_NOTIFICATION_LIMIT}件未満の場合はhasMoreをfalseにする`, async () => {
      const notifications = Array.from({ length: 5 }, (_, i) =>
        createMockNotification({ id: `n-${i}`, title: `通知${i}` })
      );
      mockApi.list.mockResolvedValue({ notifications });

      await useNotificationStore.getState().fetchNotifications();

      expect(useNotificationStore.getState().hasMore).toBe(false);
    });

    it(`${DEFAULT_NOTIFICATION_LIMIT}件以上の場合はhasMoreをtrueにする`, async () => {
      const notifications = Array.from({ length: DEFAULT_NOTIFICATION_LIMIT }, (_, i) =>
        createMockNotification({ id: `n-${i}`, title: `通知${i}` })
      );
      mockApi.list.mockResolvedValue({ notifications });

      await useNotificationStore.getState().fetchNotifications();

      expect(useNotificationStore.getState().hasMore).toBe(true);
    });

    it('エラー時にerrorを設定する', async () => {
      mockApi.list.mockRejectedValue(new Error('ネットワークエラー'));

      await useNotificationStore.getState().fetchNotifications();

      const state = useNotificationStore.getState();
      expect(state.error).toBe('ネットワークエラー');
      expect(state.isLoading).toBe(false);
    });
  });

  describe('fetchMoreNotifications', () => {
    it('追加の通知を取得して既存リストに追加する', async () => {
      // 初期通知をセット
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1', title: '通知1' })],
        hasMore: true,
      });
      const newNotifications = [createMockNotification({ id: 'n-2', title: '通知2' })];
      mockApi.list.mockResolvedValue({ notifications: newNotifications });

      await useNotificationStore.getState().fetchMoreNotifications();

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.isLoadingMore).toBe(false);
    });

    it('hasMoreがfalseの場合は取得しない', async () => {
      useNotificationStore.setState({ hasMore: false });

      await useNotificationStore.getState().fetchMoreNotifications();

      expect(mockApi.list).not.toHaveBeenCalled();
    });

    it('isLoadingMore中は取得しない', async () => {
      useNotificationStore.setState({ isLoadingMore: true, hasMore: true });

      await useNotificationStore.getState().fetchMoreNotifications();

      expect(mockApi.list).not.toHaveBeenCalled();
    });

    it('エラー時はisLoadingMoreをfalseにする', async () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1' })],
        hasMore: true,
      });
      mockApi.list.mockRejectedValue(new Error('ネットワークエラー'));

      await useNotificationStore.getState().fetchMoreNotifications();

      expect(useNotificationStore.getState().isLoadingMore).toBe(false);
      expect(console.error).toHaveBeenCalledWith(
        '追加通知の取得に失敗:',
        expect.any(Error)
      );
    });
  });

  describe('fetchUnreadCount', () => {
    it('未読数を取得する', async () => {
      mockApi.getUnreadCount.mockResolvedValue({ count: 5 });

      await useNotificationStore.getState().fetchUnreadCount();

      expect(useNotificationStore.getState().unreadCount).toBe(5);
    });

    it('エラー時は未読数を変更しない', async () => {
      useNotificationStore.setState({ unreadCount: 3 });
      mockApi.getUnreadCount.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().fetchUnreadCount();

      expect(useNotificationStore.getState().unreadCount).toBe(3);
      expect(console.error).toHaveBeenCalledWith(
        '未読数の取得に失敗:',
        expect.any(Error)
      );
    });
  });

  describe('fetchPreferences', () => {
    it('通知設定を取得する', async () => {
      const prefs = [
        createMockNotificationPreference({ type: 'ORG_INVITATION', emailEnabled: true, inAppEnabled: true }),
      ];
      mockApi.getPreferences.mockResolvedValue({ preferences: prefs });

      await useNotificationStore.getState().fetchPreferences();

      expect(useNotificationStore.getState().preferences).toEqual(prefs);
    });

    it('エラー時は設定を変更しない', async () => {
      const existingPrefs = [
        createMockNotificationPreference({ type: 'ORG_INVITATION' }),
      ];
      useNotificationStore.setState({ preferences: existingPrefs });
      mockApi.getPreferences.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().fetchPreferences();

      expect(useNotificationStore.getState().preferences).toEqual(existingPrefs);
      expect(console.error).toHaveBeenCalledWith(
        '通知設定の取得に失敗:',
        expect.any(Error)
      );
    });
  });

  describe('markAsRead', () => {
    it('通知を既読にする', async () => {
      useNotificationStore.setState({
        notifications: [
          createMockNotification({ id: 'n-1', title: '通知1' }),
          createMockNotification({ id: 'n-2', title: '通知2' }),
        ],
        unreadCount: 2,
      });
      mockApi.markAsRead.mockResolvedValue({ notification: createMockNotification({ id: 'n-1' }) });

      await useNotificationStore.getState().markAsRead('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].readAt).toBeTruthy();
      expect(state.notifications[1].readAt).toBeNull();
      expect(state.unreadCount).toBe(1);
    });

    it('エラー時は状態を変更しない', async () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1' })],
        unreadCount: 1,
      });
      mockApi.markAsRead.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().markAsRead('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].readAt).toBeNull();
      expect(state.unreadCount).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        '既読処理に失敗:',
        expect.any(Error)
      );
    });

    it('未読数が0以下にならない', async () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1' })],
        unreadCount: 0,
      });
      mockApi.markAsRead.mockResolvedValue({ notification: createMockNotification({ id: 'n-1' }) });

      await useNotificationStore.getState().markAsRead('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('全通知を既読にする', async () => {
      useNotificationStore.setState({
        notifications: [
          createMockNotification({ id: 'n-1' }),
          createMockNotification({ id: 'n-2' }),
        ],
        unreadCount: 2,
      });
      mockApi.markAllAsRead.mockResolvedValue({ updatedCount: 2 });

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.readAt)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('エラー時は状態を変更しない', async () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1' })],
        unreadCount: 1,
      });
      mockApi.markAllAsRead.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications[0].readAt).toBeNull();
      expect(state.unreadCount).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        '全既読処理に失敗:',
        expect.any(Error)
      );
    });
  });

  describe('deleteNotification', () => {
    it('通知を削除する', async () => {
      useNotificationStore.setState({
        notifications: [
          createMockNotification({ id: 'n-1' }),
          createMockNotification({ id: 'n-2', readAt: '2024-01-01T00:00:00Z' }),
        ],
        unreadCount: 1,
      });
      mockApi.delete.mockResolvedValue(undefined as never);

      await useNotificationStore.getState().deleteNotification('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('n-2');
      expect(state.unreadCount).toBe(0);
    });

    it('エラー時は状態を変更しない', async () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1' })],
        unreadCount: 1,
      });
      mockApi.delete.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().deleteNotification('n-1');

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      expect(useNotificationStore.getState().unreadCount).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        '通知の削除に失敗:',
        expect.any(Error)
      );
    });

    it('既読の通知を削除しても未読数は変わらない', async () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1', readAt: '2024-01-01T00:00:00Z' })],
        unreadCount: 0,
      });
      mockApi.delete.mockResolvedValue(undefined as never);

      await useNotificationStore.getState().deleteNotification('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('updatePreference', () => {
    it('通知設定を更新する', async () => {
      useNotificationStore.setState({
        preferences: [
          createMockNotificationPreference({ type: 'ORG_INVITATION', emailEnabled: true, inAppEnabled: true }),
        ],
      });
      const updatedPref = createMockNotificationPreference({
        type: 'ORG_INVITATION',
        emailEnabled: false,
        inAppEnabled: true,
      });
      mockApi.updatePreference.mockResolvedValue({ preference: updatedPref });

      await useNotificationStore.getState().updatePreference(
        'ORG_INVITATION',
        { emailEnabled: false }
      );

      expect(useNotificationStore.getState().preferences[0]).toEqual(updatedPref);
    });

    it('エラー時は設定を変更しない', async () => {
      const originalPref = createMockNotificationPreference({
        type: 'ORG_INVITATION',
        emailEnabled: true,
        inAppEnabled: true,
      });
      useNotificationStore.setState({ preferences: [originalPref] });
      mockApi.updatePreference.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().updatePreference(
        'ORG_INVITATION',
        { emailEnabled: false }
      );

      expect(useNotificationStore.getState().preferences[0]).toEqual(originalPref);
      expect(console.error).toHaveBeenCalledWith(
        '通知設定の更新に失敗:',
        expect.any(Error)
      );
    });
  });

  describe('handleNotificationReceived', () => {
    it('新しい通知をリストの先頭に追加する', () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1' })],
        unreadCount: 0,
      });

      useNotificationStore.getState().handleNotificationReceived(
        createMockNotification({ id: 'n-2', title: '新しい通知' })
      );

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(2);
      expect(state.notifications[0].id).toBe('n-2');
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('handleUnreadCountUpdate', () => {
    it('未読数を更新する', () => {
      useNotificationStore.getState().handleUnreadCountUpdate(10);
      expect(useNotificationStore.getState().unreadCount).toBe(10);
    });
  });

  describe('reset', () => {
    it('ストアを初期状態にリセットする', () => {
      useNotificationStore.setState({
        notifications: [createMockNotification({ id: 'n-1' })],
        unreadCount: 5,
        isLoading: true,
        error: 'エラー',
      });

      useNotificationStore.getState().reset();

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual([]);
      expect(state.unreadCount).toBe(0);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
