import { api } from './client.js';
import type {
  Notification,
  NotificationType,
  NotificationPreference,
  GetNotificationsParams,
} from './types.js';

// ============================================
// 通知API
// ============================================

export const notificationsApi = {
  // 通知一覧を取得
  list: (params?: GetNotificationsParams) => {
    const query = new URLSearchParams();
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    if (params?.offset !== undefined) query.set('offset', String(params.offset));
    if (params?.unreadOnly !== undefined) query.set('unreadOnly', String(params.unreadOnly));
    const queryString = query.toString();
    return api.get<{ notifications: Notification[] }>(
      `/api/notifications${queryString ? `?${queryString}` : ''}`
    );
  },

  // 未読数を取得
  getUnreadCount: () =>
    api.get<{ count: number }>('/api/notifications/unread-count'),

  // 通知を既読にする
  markAsRead: (id: string) =>
    api.patch<{ notification: Notification }>(`/api/notifications/${id}/read`),

  // 全て既読にする
  markAllAsRead: () =>
    api.post<{ updatedCount: number }>('/api/notifications/mark-all-read'),

  // 通知を削除
  delete: (id: string) =>
    api.delete<void>(`/api/notifications/${id}`),

  // 通知設定を取得
  getPreferences: () =>
    api.get<{ preferences: NotificationPreference[] }>('/api/notifications/preferences'),

  // 通知設定を更新
  updatePreference: (type: NotificationType, data: { emailEnabled?: boolean; inAppEnabled?: boolean }) =>
    api.patch<{ preference: NotificationPreference }>(`/api/notifications/preferences/${type}`, data),
};
