import { useEffect } from 'react';
import { Link } from 'react-router';
import { Bell, Check, Settings, ArrowLeft, Loader2 } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationItem } from '../components/notification';

const INITIAL_LIMIT = 20;
const LOAD_MORE_LIMIT = 20;

/**
 * 通知一覧ページ
 */
export default function Notifications() {
  const {
    notifications,
    unreadCount,
    isLoading,
    isLoadingMore,
    hasMore,
    fetchNotifications,
    fetchMoreNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // ページ読み込み時に通知を取得
  useEffect(() => {
    fetchNotifications({ limit: INITIAL_LIMIT });
  }, [fetchNotifications]);

  // もっと読み込む
  const handleLoadMore = () => {
    fetchMoreNotifications(LOAD_MORE_LIMIT);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">通知</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-foreground-muted mt-1">
                {unreadCount}件の未読通知があります
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-2 px-3 py-2 text-sm text-accent hover:bg-accent-subtle rounded transition-colors"
            >
              <Check className="w-4 h-4" />
              全て既読にする
            </button>
          )}
          <Link
            to="/settings/notifications"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground-secondary hover:bg-background-tertiary rounded transition-colors"
          >
            <Settings className="w-4 h-4" />
            通知設定
          </Link>
        </div>
      </div>

      {/* 通知リスト */}
      <div className="bg-background-secondary border border-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-foreground-muted">
            <Bell className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg">通知はありません</p>
            <p className="text-sm mt-1">新しい通知が届くとここに表示されます</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))}
            </div>
            {/* もっと読み込む */}
            {hasMore && notifications.length > 0 && (
              <div className="p-4 border-t border-border">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full flex items-center justify-center gap-2 py-2 text-sm text-accent hover:bg-accent-subtle rounded transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      読み込み中...
                    </>
                  ) : (
                    'もっと読み込む'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
