import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import { Bell, Check, Settings } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from './NotificationItem';

/**
 * 通知センター（ヘッダーの通知ベル + ドロップダウン）
 */
export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    isLoading,
    initialize,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 初期化
  useEffect(() => {
    initialize();
  }, [initialize]);

  // 外部クリックで閉じる
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Escで閉じる
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 通知ベルボタン */}
      <button
        onClick={handleToggle}
        className="relative p-2 text-foreground-muted hover:text-foreground hover:bg-background-tertiary rounded transition-colors"
        aria-label={`通知 ${unreadCount > 0 ? `(${unreadCount}件の未読)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-5 h-5" />
        {/* 未読バッジ */}
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-xs font-medium text-white bg-error rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-background-secondary border border-border rounded-lg shadow-lg overflow-hidden z-50">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="font-medium text-foreground">通知</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors"
                  title="全て既読にする"
                >
                  <Check className="w-3 h-3" />
                  全て既読
                </button>
              )}
              <Link
                to="/settings/notifications"
                onClick={() => setIsOpen(false)}
                className="p-1 text-foreground-muted hover:text-foreground transition-colors"
                title="通知設定"
              >
                <Settings className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* 通知リスト */}
          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-foreground-muted">
                <Bell className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">通知はありません</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.slice(0, 10).map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                    onClick={() => setIsOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* フッター */}
          {notifications.length > 0 && (
            <div className="border-t border-border">
              <Link
                to="/notifications"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 text-center text-sm text-accent hover:bg-background-tertiary transition-colors"
              >
                全ての通知を見る
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
