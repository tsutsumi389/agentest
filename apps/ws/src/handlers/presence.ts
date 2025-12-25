import type { WebSocket } from 'ws';
import type {
  UserJoinedEvent,
  UserLeftEvent,
  PresenceListEvent,
} from '@agentest/ws-types';
import type { AuthenticatedUser } from '../auth.js';

// チャンネルごとのプレゼンスユーザー
const channelPresence = new Map<string, Map<string, AuthenticatedUser>>();

/**
 * ユーザーがチャンネルに参加した時の処理
 */
export async function handlePresenceJoin(
  channel: string,
  user: AuthenticatedUser,
  subscribers: Set<WebSocket>
): Promise<void> {
  // プレゼンスマップを更新
  if (!channelPresence.has(channel)) {
    channelPresence.set(channel, new Map());
  }
  const presence = channelPresence.get(channel)!;
  const isNewUser = !presence.has(user.id);
  presence.set(user.id, user);

  // 新しいユーザーの場合のみ通知
  if (isNewUser) {
    const event: UserJoinedEvent = {
      type: 'presence:user_joined',
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      channel,
      user: {
        id: user.id,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    };

    const message = JSON.stringify(event);
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  // 参加したユーザーに現在のプレゼンスリストを送信
  const users = Array.from(presence.values()).map((u) => ({
    id: u.id,
    name: u.name,
    avatarUrl: u.avatarUrl,
  }));

  const listEvent: PresenceListEvent = {
    type: 'presence:list',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    channel,
    users,
  };

  // 参加したユーザーのWebSocketを特定してリストを送信
  for (const ws of subscribers) {
    const extWs = ws as WebSocket & { userId?: string };
    if (extWs.userId === user.id && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(listEvent));
      break;
    }
  }
}

/**
 * ユーザーがチャンネルを離れた時の処理
 */
export async function handlePresenceLeave(
  channel: string,
  userId: string,
  subscribers: Set<WebSocket>
): Promise<void> {
  const presence = channelPresence.get(channel);
  if (!presence) return;

  // まだ他の接続がある場合は通知しない
  let hasOtherConnection = false;
  for (const ws of subscribers) {
    const extWs = ws as WebSocket & { userId?: string };
    if (extWs.userId === userId) {
      hasOtherConnection = true;
      break;
    }
  }

  if (!hasOtherConnection) {
    presence.delete(userId);

    const event: UserLeftEvent = {
      type: 'presence:user_left',
      eventId: crypto.randomUUID(),
      timestamp: Date.now(),
      channel,
      userId,
    };

    const message = JSON.stringify(event);
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }

    // プレゼンスマップが空になったら削除
    if (presence.size === 0) {
      channelPresence.delete(channel);
    }
  }
}

/**
 * チャンネルのプレゼンスリストを取得
 */
export function getChannelPresence(channel: string): AuthenticatedUser[] {
  const presence = channelPresence.get(channel);
  return presence ? Array.from(presence.values()) : [];
}
