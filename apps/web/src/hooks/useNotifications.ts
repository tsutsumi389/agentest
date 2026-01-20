import { useEffect, useCallback } from 'react';
import type { NotificationReceivedEvent, NotificationUnreadCountEvent } from '@agentest/ws-types';
import { useNotificationStore } from '../stores/notification';
import { wsClient } from '../lib/ws';
import { toast } from '../stores/toast';
import type { Notification } from '../lib/api';

/**
 * 通知機能を提供するフック
 * - WebSocket購読
 * - 通知受信時のトースト表示
 * - 未読数の同期
 */
export function useNotifications() {
  const store = useNotificationStore();

  // 初期データの取得
  const initialize = useCallback(async () => {
    await Promise.all([
      store.fetchNotifications(),
      store.fetchUnreadCount(),
    ]);
  }, [store]);

  // WebSocket購読
  useEffect(() => {
    // 通知受信イベント
    const unsubReceived = wsClient.on<NotificationReceivedEvent>(
      'notification:received',
      (event) => {
        // ストアに追加
        store.handleNotificationReceived(event.notification as Notification);

        // トースト表示
        toast.info(`${event.notification.title}: ${event.notification.body}`);
      }
    );

    // 未読数更新イベント
    const unsubUnreadCount = wsClient.on<NotificationUnreadCountEvent>(
      'notification:unread_count',
      (event) => {
        store.handleUnreadCountUpdate(event.count);
      }
    );

    // クリーンアップ
    return () => {
      unsubReceived();
      unsubUnreadCount();
    };
  }, [store]);

  return {
    // 状態
    notifications: store.notifications,
    unreadCount: store.unreadCount,
    preferences: store.preferences,
    isLoading: store.isLoading,
    error: store.error,

    // アクション
    initialize,
    fetchNotifications: store.fetchNotifications,
    fetchUnreadCount: store.fetchUnreadCount,
    fetchPreferences: store.fetchPreferences,
    markAsRead: store.markAsRead,
    markAllAsRead: store.markAllAsRead,
    deleteNotification: store.deleteNotification,
    updatePreference: store.updatePreference,
    reset: store.reset,
  };
}
