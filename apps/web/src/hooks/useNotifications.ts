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
  // Zustandから状態とアクションを個別に取得（アクションは安定した参照）
  const notifications = useNotificationStore((state) => state.notifications);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const preferences = useNotificationStore((state) => state.preferences);
  const isLoading = useNotificationStore((state) => state.isLoading);
  const error = useNotificationStore((state) => state.error);

  // アクションは安定した参照なので一度だけ取得
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount);
  const fetchPreferences = useNotificationStore((state) => state.fetchPreferences);
  const markAsRead = useNotificationStore((state) => state.markAsRead);
  const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);
  const deleteNotification = useNotificationStore((state) => state.deleteNotification);
  const updatePreference = useNotificationStore((state) => state.updatePreference);
  const handleNotificationReceived = useNotificationStore((state) => state.handleNotificationReceived);
  const handleUnreadCountUpdate = useNotificationStore((state) => state.handleUnreadCountUpdate);
  const reset = useNotificationStore((state) => state.reset);

  // 初期データの取得
  const initialize = useCallback(async () => {
    await Promise.all([
      fetchNotifications(),
      fetchUnreadCount(),
    ]);
  }, [fetchNotifications, fetchUnreadCount]);

  // WebSocket購読
  useEffect(() => {
    // 通知受信イベント
    const unsubReceived = wsClient.on<NotificationReceivedEvent>(
      'notification:received',
      (event) => {
        // ストアに追加
        handleNotificationReceived(event.notification as Notification);

        // トースト表示
        toast.info(`${event.notification.title}: ${event.notification.body}`);
      }
    );

    // 未読数更新イベント
    const unsubUnreadCount = wsClient.on<NotificationUnreadCountEvent>(
      'notification:unread_count',
      (event) => {
        handleUnreadCountUpdate(event.count);
      }
    );

    // クリーンアップ
    return () => {
      unsubReceived();
      unsubUnreadCount();
    };
  }, [handleNotificationReceived, handleUnreadCountUpdate]);

  return {
    // 状態
    notifications,
    unreadCount,
    preferences,
    isLoading,
    error,

    // アクション
    initialize,
    fetchNotifications,
    fetchUnreadCount,
    fetchPreferences,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    updatePreference,
    reset,
  };
}
