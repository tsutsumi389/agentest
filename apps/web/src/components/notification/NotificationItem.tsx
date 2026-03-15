import { useState } from 'react';
import { useNavigate } from 'react-router';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { getNotificationNavigationPath } from '../../lib/notification-navigation';
import { Mail, UserPlus, Users, MessageSquare, CheckCircle, XCircle, X } from 'lucide-react';
import type { Notification, NotificationType } from '../../lib/api';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick?: () => void;
}

/**
 * 通知タイプに応じたアイコンを取得
 */
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'ORG_INVITATION':
      return <Mail className="w-5 h-5 text-accent" />;
    case 'INVITATION_ACCEPTED':
      return <UserPlus className="w-5 h-5 text-success" />;
    case 'PROJECT_ADDED':
      return <Users className="w-5 h-5 text-accent" />;
    case 'REVIEW_COMMENT':
      return <MessageSquare className="w-5 h-5 text-accent" />;
    case 'TEST_COMPLETED':
      return <CheckCircle className="w-5 h-5 text-success" />;
    case 'TEST_FAILED':
      return <XCircle className="w-5 h-5 text-error" />;
    default:
      return <Mail className="w-5 h-5 text-foreground-muted" />;
  }
}

/**
 * 個別通知の表示コンポーネント
 */
export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClick,
}: NotificationItemProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const isUnread = !notification.readAt;

  const handleClick = () => {
    if (isUnread) {
      onMarkAsRead(notification.id);
    }
    const path = getNotificationNavigationPath(notification);
    if (path) {
      navigate(path);
    }
    onClick?.();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ja,
  });

  return (
    <div
      className={`
        relative flex items-start gap-3 p-3 cursor-pointer transition-colors
        ${isUnread ? 'bg-accent-subtle/30' : 'hover:bg-background-tertiary'}
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 未読インジケーター */}
      {isUnread && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-accent" />
      )}

      {/* アイコン */}
      <div className="flex-shrink-0 mt-0.5 ml-2">{getNotificationIcon(notification.type)}</div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm ${isUnread ? 'font-medium text-foreground' : 'text-foreground-secondary'}`}
        >
          {notification.title}
        </p>
        <p className="text-xs text-foreground-muted mt-0.5 line-clamp-2">{notification.body}</p>
        <p className="text-xs text-foreground-muted mt-1">{timeAgo}</p>
      </div>

      {/* 削除ボタン（ホバー時のみ表示） */}
      {isHovered && (
        <button
          onClick={handleDelete}
          className="flex-shrink-0 p-1 text-foreground-muted hover:text-error transition-colors"
          title="削除"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
