import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useNotificationStore } from '../notification';

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
        { id: 'n-1', title: '通知1', body: '本文1', readAt: null },
        { id: 'n-2', title: '通知2', body: '本文2', readAt: null },
      ];
      mockApi.list.mockResolvedValue({ notifications: mockNotifications } as any);

      await useNotificationStore.getState().fetchNotifications();

      const state = useNotificationStore.getState();
      expect(state.notifications).toEqual(mockNotifications);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('20件未満の場合はhasMoreをfalseにする', async () => {
      const notifications = Array.from({ length: 5 }, (_, i) => ({
        id: `n-${i}`,
        title: `通知${i}`,
      }));
      mockApi.list.mockResolvedValue({ notifications } as any);

      await useNotificationStore.getState().fetchNotifications();

      expect(useNotificationStore.getState().hasMore).toBe(false);
    });

    it('20件以上の場合はhasMoreをtrueにする', async () => {
      const notifications = Array.from({ length: 20 }, (_, i) => ({
        id: `n-${i}`,
        title: `通知${i}`,
      }));
      mockApi.list.mockResolvedValue({ notifications } as any);

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
        notifications: [{ id: 'n-1', title: '通知1' }] as any,
        hasMore: true,
      });
      const newNotifications = [{ id: 'n-2', title: '通知2' }];
      mockApi.list.mockResolvedValue({ notifications: newNotifications } as any);

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
  });

  describe('fetchUnreadCount', () => {
    it('未読数を取得する', async () => {
      mockApi.getUnreadCount.mockResolvedValue({ count: 5 } as any);

      await useNotificationStore.getState().fetchUnreadCount();

      expect(useNotificationStore.getState().unreadCount).toBe(5);
    });

    it('エラー時は未読数を変更しない', async () => {
      useNotificationStore.setState({ unreadCount: 3 });
      mockApi.getUnreadCount.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().fetchUnreadCount();

      expect(useNotificationStore.getState().unreadCount).toBe(3);
    });
  });

  describe('fetchPreferences', () => {
    it('通知設定を取得する', async () => {
      const prefs = [{ type: 'EXECUTION_COMPLETED', emailEnabled: true, inAppEnabled: true }];
      mockApi.getPreferences.mockResolvedValue({ preferences: prefs } as any);

      await useNotificationStore.getState().fetchPreferences();

      expect(useNotificationStore.getState().preferences).toEqual(prefs);
    });

    it('エラー時は設定を変更しない', async () => {
      const existingPrefs = [{ type: 'EXECUTION_COMPLETED' }] as any;
      useNotificationStore.setState({ preferences: existingPrefs });
      mockApi.getPreferences.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().fetchPreferences();

      expect(useNotificationStore.getState().preferences).toEqual(existingPrefs);
    });
  });

  describe('markAsRead', () => {
    it('通知を既読にする', async () => {
      useNotificationStore.setState({
        notifications: [
          { id: 'n-1', title: '通知1', readAt: null },
          { id: 'n-2', title: '通知2', readAt: null },
        ] as any,
        unreadCount: 2,
      });
      mockApi.markAsRead.mockResolvedValue({} as any);

      await useNotificationStore.getState().markAsRead('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].readAt).toBeTruthy();
      expect(state.notifications[1].readAt).toBeNull();
      expect(state.unreadCount).toBe(1);
    });

    it('エラー時は状態を変更しない', async () => {
      useNotificationStore.setState({
        notifications: [{ id: 'n-1', readAt: null }] as any,
        unreadCount: 1,
      });
      mockApi.markAsRead.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().markAsRead('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications[0].readAt).toBeNull();
      expect(state.unreadCount).toBe(1);
    });

    it('未読数が0以下にならない', async () => {
      useNotificationStore.setState({
        notifications: [{ id: 'n-1', readAt: null }] as any,
        unreadCount: 0,
      });
      mockApi.markAsRead.mockResolvedValue({} as any);

      await useNotificationStore.getState().markAsRead('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('markAllAsRead', () => {
    it('全通知を既読にする', async () => {
      useNotificationStore.setState({
        notifications: [
          { id: 'n-1', readAt: null },
          { id: 'n-2', readAt: null },
        ] as any,
        unreadCount: 2,
      });
      mockApi.markAllAsRead.mockResolvedValue({} as any);

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications.every((n) => n.readAt)).toBe(true);
      expect(state.unreadCount).toBe(0);
    });

    it('エラー時は状態を変更しない', async () => {
      useNotificationStore.setState({
        notifications: [{ id: 'n-1', readAt: null }] as any,
        unreadCount: 1,
      });
      mockApi.markAllAsRead.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().markAllAsRead();

      const state = useNotificationStore.getState();
      expect(state.notifications[0].readAt).toBeNull();
      expect(state.unreadCount).toBe(1);
    });
  });

  describe('deleteNotification', () => {
    it('通知を削除する', async () => {
      useNotificationStore.setState({
        notifications: [
          { id: 'n-1', readAt: null },
          { id: 'n-2', readAt: '2024-01-01' },
        ] as any,
        unreadCount: 1,
      });
      mockApi.delete.mockResolvedValue({} as any);

      await useNotificationStore.getState().deleteNotification('n-1');

      const state = useNotificationStore.getState();
      expect(state.notifications).toHaveLength(1);
      expect(state.notifications[0].id).toBe('n-2');
      expect(state.unreadCount).toBe(0);
    });

    it('エラー時は状態を変更しない', async () => {
      useNotificationStore.setState({
        notifications: [{ id: 'n-1', readAt: null }] as any,
        unreadCount: 1,
      });
      mockApi.delete.mockRejectedValue(new Error('エラー'));

      await useNotificationStore.getState().deleteNotification('n-1');

      expect(useNotificationStore.getState().notifications).toHaveLength(1);
      expect(useNotificationStore.getState().unreadCount).toBe(1);
    });

    it('既読の通知を削除しても未読数は変わらない', async () => {
      useNotificationStore.setState({
        notifications: [{ id: 'n-1', readAt: '2024-01-01' }] as any,
        unreadCount: 0,
      });
      mockApi.delete.mockResolvedValue({} as any);

      await useNotificationStore.getState().deleteNotification('n-1');

      expect(useNotificationStore.getState().unreadCount).toBe(0);
    });
  });

  describe('updatePreference', () => {
    it('通知設定を更新する', async () => {
      useNotificationStore.setState({
        preferences: [
          { type: 'EXECUTION_COMPLETED', emailEnabled: true, inAppEnabled: true },
        ] as any,
      });
      const updatedPref = { type: 'EXECUTION_COMPLETED', emailEnabled: false, inAppEnabled: true };
      mockApi.updatePreference.mockResolvedValue({ preference: updatedPref } as any);

      await useNotificationStore.getState().updatePreference(
        'EXECUTION_COMPLETED' as any,
        { emailEnabled: false }
      );

      expect(useNotificationStore.getState().preferences[0]).toEqual(updatedPref);
    });
  });

  describe('handleNotificationReceived', () => {
    it('新しい通知をリストの先頭に追加する', () => {
      useNotificationStore.setState({
        notifications: [{ id: 'n-1' }] as any,
        unreadCount: 0,
      });

      useNotificationStore.getState().handleNotificationReceived({
        id: 'n-2',
        title: '新しい通知',
      } as any);

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
        notifications: [{ id: 'n-1' }] as any,
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
