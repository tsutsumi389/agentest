import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type {
  ClientMessage,
  ServerMessage,
  ServerEvent,
} from '@agentest/ws-types';
import { authenticateToken, extractTokenFromUrl, type AuthenticatedUser } from './auth.js';
import { subscriber, subscribeToChannel, unsubscribeFromChannel } from './redis.js';
import { handlePresenceJoin, handlePresenceLeave } from './handlers/presence.js';

// クライアント情報を拡張
interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  user?: AuthenticatedUser;
  channels: Set<string>;
  isAlive: boolean;
}

// WebSocketサーバー
let wss: WebSocketServer;

// ユーザーIDからWebSocketへのマップ
const userConnections = new Map<string, Set<ExtendedWebSocket>>();

// チャンネルからWebSocketへのマップ
const channelSubscribers = new Map<string, Set<ExtendedWebSocket>>();

/**
 * WebSocketサーバーを作成
 */
export function createWebSocketServer(port: number, host: string): WebSocketServer {
  wss = new WebSocketServer({ port, host });

  console.log(`🔌 WebSocketサーバーが起動しました: ws://${host}:${port}`);

  // 接続ハンドラ
  wss.on('connection', handleConnection);

  // Redisサブスクライバーのメッセージハンドラ
  subscriber.on('message', handleRedisMessage);

  // ヘルスチェック用ping
  setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        cleanupConnection(extWs);
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  return wss;
}

/**
 * 接続ハンドラ
 */
async function handleConnection(ws: WebSocket, request: IncomingMessage): Promise<void> {
  const extWs = ws as ExtendedWebSocket;
  extWs.channels = new Set();
  extWs.isAlive = true;

  // Pongレスポンス
  extWs.on('pong', () => {
    extWs.isAlive = true;
  });

  // URLからトークンを取得して認証
  const token = extractTokenFromUrl(request.url || '');
  if (token) {
    const user = await authenticateToken(token);
    if (user) {
      extWs.userId = user.id;
      extWs.user = user;
      registerConnection(extWs);
      sendMessage(extWs, {
        type: 'authenticated',
        userId: user.id,
        timestamp: Date.now(),
      });
    }
  }

  // メッセージハンドラ
  extWs.on('message', (data) => handleMessage(extWs, data.toString()));

  // クローズハンドラ
  extWs.on('close', () => cleanupConnection(extWs));

  // エラーハンドラ
  extWs.on('error', (error) => {
    console.error('WebSocketエラー:', error);
    cleanupConnection(extWs);
  });
}

/**
 * メッセージハンドラ
 */
async function handleMessage(ws: ExtendedWebSocket, data: string): Promise<void> {
  try {
    const message = JSON.parse(data) as ClientMessage;

    switch (message.type) {
      case 'authenticate':
        await handleAuthenticate(ws, message.token);
        break;

      case 'subscribe':
        await handleSubscribe(ws, message.channels);
        break;

      case 'unsubscribe':
        await handleUnsubscribe(ws, message.channels);
        break;

      case 'ping':
        sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;

      case 'heartbeat':
        // ハートビート処理（ロック延長など）
        ws.isAlive = true;
        break;

      default:
        sendError(ws, 'UNKNOWN_MESSAGE_TYPE', '不明なメッセージタイプです');
    }
  } catch (error) {
    console.error('メッセージ処理エラー:', error);
    sendError(ws, 'INVALID_MESSAGE', 'メッセージの形式が不正です');
  }
}

/**
 * 認証処理
 */
async function handleAuthenticate(ws: ExtendedWebSocket, token: string): Promise<void> {
  const user = await authenticateToken(token);

  if (!user) {
    sendError(ws, 'AUTHENTICATION_FAILED', '認証に失敗しました');
    return;
  }

  // 既存の接続があればクリーンアップ
  if (ws.userId && ws.userId !== user.id) {
    cleanupConnection(ws);
  }

  ws.userId = user.id;
  ws.user = user;
  registerConnection(ws);

  sendMessage(ws, {
    type: 'authenticated',
    userId: user.id,
    timestamp: Date.now(),
  });
}

/**
 * サブスクライブ処理
 */
async function handleSubscribe(ws: ExtendedWebSocket, channels: string[]): Promise<void> {
  if (!ws.userId) {
    sendError(ws, 'NOT_AUTHENTICATED', '認証が必要です');
    return;
  }

  const subscribedChannels: string[] = [];

  for (const channel of channels) {
    // チャンネルにサブスクライブ
    if (!channelSubscribers.has(channel)) {
      channelSubscribers.set(channel, new Set());
      await subscribeToChannel(channel);
    }

    channelSubscribers.get(channel)!.add(ws);
    ws.channels.add(channel);
    subscribedChannels.push(channel);

    // プレゼンス通知
    if (ws.user) {
      await handlePresenceJoin(channel, ws.user, channelSubscribers.get(channel)!);
    }
  }

  sendMessage(ws, {
    type: 'subscribed',
    channels: subscribedChannels,
    timestamp: Date.now(),
  });
}

/**
 * アンサブスクライブ処理
 */
async function handleUnsubscribe(ws: ExtendedWebSocket, channels: string[]): Promise<void> {
  for (const channel of channels) {
    const subscribers = channelSubscribers.get(channel);
    if (subscribers) {
      subscribers.delete(ws);
      ws.channels.delete(channel);

      // プレゼンス通知
      if (ws.user) {
        await handlePresenceLeave(channel, ws.user.id, subscribers);
      }

      // サブスクライバーがいなくなったらRedisからもアンサブスクライブ
      if (subscribers.size === 0) {
        channelSubscribers.delete(channel);
        await unsubscribeFromChannel(channel);
      }
    }
  }
}

/**
 * Redisメッセージハンドラ
 */
function handleRedisMessage(channel: string, message: string): void {
  try {
    // 型チェックのためにパース（送信時は元のメッセージを使用）
    JSON.parse(message) as ServerEvent;
    const subscribers = channelSubscribers.get(channel);

    if (subscribers) {
      for (const ws of subscribers) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  } catch (error) {
    console.error('Redisメッセージ処理エラー:', error);
  }
}

/**
 * 接続を登録
 */
function registerConnection(ws: ExtendedWebSocket): void {
  if (!ws.userId) return;

  if (!userConnections.has(ws.userId)) {
    userConnections.set(ws.userId, new Set());
  }
  userConnections.get(ws.userId)!.add(ws);
}

/**
 * 接続をクリーンアップ
 */
async function cleanupConnection(ws: ExtendedWebSocket): Promise<void> {
  // ユーザー接続マップから削除
  if (ws.userId) {
    const connections = userConnections.get(ws.userId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        userConnections.delete(ws.userId);
      }
    }
  }

  // チャンネルからアンサブスクライブ
  for (const channel of ws.channels) {
    const subscribers = channelSubscribers.get(channel);
    if (subscribers) {
      subscribers.delete(ws);

      // プレゼンス通知
      if (ws.user) {
        await handlePresenceLeave(channel, ws.user.id, subscribers);
      }

      if (subscribers.size === 0) {
        channelSubscribers.delete(channel);
        await unsubscribeFromChannel(channel);
      }
    }
  }

  ws.channels.clear();
}

/**
 * メッセージを送信
 */
function sendMessage(ws: ExtendedWebSocket, message: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * エラーメッセージを送信
 */
function sendError(ws: ExtendedWebSocket, code: string, message: string): void {
  sendMessage(ws, {
    type: 'error',
    code,
    message,
    timestamp: Date.now(),
  });
}

/**
 * 特定のユーザーにイベントを送信
 */
export function sendToUser(userId: string, event: ServerEvent): void {
  const connections = userConnections.get(userId);
  if (connections) {
    const message = JSON.stringify(event);
    for (const ws of connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

/**
 * チャンネルにイベントをブロードキャスト
 */
export function broadcastToChannel(channel: string, event: ServerEvent): void {
  const subscribers = channelSubscribers.get(channel);
  if (subscribers) {
    const message = JSON.stringify(event);
    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }
}

/**
 * サーバーを終了
 */
export function closeServer(): Promise<void> {
  return new Promise((resolve) => {
    wss.close(() => {
      console.log('WebSocketサーバーを終了しました');
      resolve();
    });
  });
}
