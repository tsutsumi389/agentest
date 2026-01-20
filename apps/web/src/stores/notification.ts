import { create } from 'zustand';
import {
  notificationsApi,
  type Notification,
  type NotificationPreference,
  type GetNotificationsParams,
} from '../lib/api';

interface NotificationState {
  // 状態
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreference[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  // アクション
  fetchNotifications: (params?: GetNotificationsParams) => Promise<void>;
  fetchMoreNotifications: (limit?: number) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  fetchPreferences: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  updatePreference: (
    type: NotificationPreference['type'],
    data: { emailEnabled?: boolean; inAppEnabled?: boolean }
  ) => Promise<void>;

  // WebSocketハンドラ
  handleNotificationReceived: (notification: Notification) => void;
  handleUnreadCountUpdate: (count: number) => void;

  // リセット
  reset: () => void;
}

/**
 * 通知ストア
 */
export const useNotificationStore = create<NotificationState>((set, get) => ({
  // 初期状態
  notifications: [],
  unreadCount: 0,
  preferences: [],
  isLoading: false,
  isLoadingMore: false,
  hasMore: true,
  error: null,

  /**
   * 通知一覧を取得（リストを置き換え）
   */
  fetchNotifications: async (params?: GetNotificationsParams) => {
    try {
      set({ isLoading: true, error: null });
      const limit = params?.limit ?? 20;
      const { notifications } = await notificationsApi.list(params);
      set({
        notifications,
        isLoading: false,
        hasMore: notifications.length >= limit,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '通知の取得に失敗しました',
        isLoading: false,
      });
    }
  },

  /**
   * 追加の通知を取得（リストに追加）
   */
  fetchMoreNotifications: async (limit = 20) => {
    const { notifications: currentNotifications, isLoadingMore, hasMore } = get();
    if (isLoadingMore || !hasMore) return;

    try {
      set({ isLoadingMore: true });
      const { notifications: newNotifications } = await notificationsApi.list({
        limit,
        offset: currentNotifications.length,
      });
      set({
        notifications: [...currentNotifications, ...newNotifications],
        isLoadingMore: false,
        hasMore: newNotifications.length >= limit,
      });
    } catch (error) {
      console.error('追加通知の取得に失敗:', error);
      set({ isLoadingMore: false });
    }
  },

  /**
   * 未読数を取得
   */
  fetchUnreadCount: async () => {
    try {
      const { count } = await notificationsApi.getUnreadCount();
      set({ unreadCount: count });
    } catch (error) {
      console.error('未読数の取得に失敗:', error);
    }
  },

  /**
   * 通知設定を取得
   */
  fetchPreferences: async () => {
    try {
      const { preferences } = await notificationsApi.getPreferences();
      set({ preferences });
    } catch (error) {
      console.error('通知設定の取得に失敗:', error);
    }
  },

  /**
   * 通知を既読にする
   */
  markAsRead: async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('既読処理に失敗:', error);
    }
  },

  /**
   * 全ての通知を既読にする
   */
  markAllAsRead: async () => {
    try {
      await notificationsApi.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('全既読処理に失敗:', error);
    }
  },

  /**
   * 通知を削除
   */
  deleteNotification: async (id: string) => {
    try {
      const notification = get().notifications.find((n) => n.id === id);
      await notificationsApi.delete(id);
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount: notification && !notification.readAt
          ? Math.max(0, state.unreadCount - 1)
          : state.unreadCount,
      }));
    } catch (error) {
      console.error('通知の削除に失敗:', error);
    }
  },

  /**
   * 通知設定を更新
   */
  updatePreference: async (type, data) => {
    try {
      const { preference } = await notificationsApi.updatePreference(type, data);
      set((state) => ({
        preferences: state.preferences.map((p) =>
          p.type === type ? preference : p
        ),
      }));
    } catch (error) {
      console.error('通知設定の更新に失敗:', error);
    }
  },

  /**
   * WebSocketから通知を受信
   */
  handleNotificationReceived: (notification: Notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  /**
   * WebSocketから未読数を更新
   */
  handleUnreadCountUpdate: (count: number) => {
    set({ unreadCount: count });
  },

  /**
   * ストアをリセット
   */
  reset: () => {
    set({
      notifications: [],
      unreadCount: 0,
      preferences: [],
      isLoading: false,
      isLoadingMore: false,
      hasMore: true,
      error: null,
    });
  },
}));
