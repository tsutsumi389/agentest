import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type {
  ServerMessage,
  ServerEvent,
} from '@agentest/ws-types';
import { z } from 'zod';
import { authenticateToken, type AuthenticatedUser } from './auth.js';
import { subscriber, subscribeToChannel, unsubscribeFromChannel } from './redis.js';
import { handlePresenceJoin, handlePresenceLeave } from './handlers/presence.js';
import { logger as baseLogger } from './utils/logger.js';

// クライアントメッセージのZodスキーマ（ランタイムバリデーション）
const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('authenticate'),
    token: z.string().min(1).max(4096),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('subscribe'),
    channels: z.array(z.string().max(200)).min(1).max(50),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    channels: z.array(z.string().max(200)).min(1).max(50),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('ping'),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('heartbeat'),
    lockId: z.string().optional(),
    timestamp: z.number(),
  }),
]);

// 許可されたチャンネル名のパターン（UUID v4形式）
const CHANNEL_PATTERN = /^(project|test_suite|test_case|execution|user):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const logger = baseLogger.child({ module: 'server' });

// 認証タイムアウト（ミリ秒）
const AUTH_TIMEOUT_MS = 10_000;

// 認証試行回数の上限
const MAX_AUTH_ATTEMPTS = 5;

// クライアント情報を拡張
interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  user?: AuthenticatedUser;
  channels: Set<string>;
  isAlive: boolean;
  authTimeout?: ReturnType<typeof setTimeout>;
  authAttempts: number;
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
  wss = new WebSocketServer({ port, host, maxPayload: 64 * 1024 });

  logger.info({ host, port }, 'WebSocketサーバーが起動しました');

  // 接続ハンドラ
  wss.on('connection', handleConnection);

  // Redisサブスクライバーのメッセージハンドラ
  subscriber.on('message', handleRedisMessage);

  // ヘルスチェック用ping
  setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        cleanupConnection(extWs).catch((err) => {
          logger.error({ err }, 'クリーンアップ中のエラー');
        });
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
 * セキュリティ対策: URLクエリパラメータでのトークン送信を廃止し、
 * 接続後にauthenticateメッセージで認証する方式を採用。
 * これにより、トークンがプロキシログやブラウザ履歴に露出するリスクを排除。
 */
async function handleConnection(ws: WebSocket, _request: IncomingMessage): Promise<void> {
  const extWs = ws as ExtendedWebSocket;
  extWs.channels = new Set();
  extWs.isAlive = true;
  extWs.authAttempts = 0;

  // 認証タイムアウト: 一定時間内に認証しなければ切断
  extWs.authTimeout = setTimeout(() => {
    if (!extWs.userId) {
      sendError(extWs, 'AUTH_TIMEOUT', '認証がタイムアウトしました');
      extWs.close();
    }
  }, AUTH_TIMEOUT_MS);

  // Pongレスポンス
  extWs.on('pong', () => {
    extWs.isAlive = true;
  });

  // メッセージハンドラ
  extWs.on('message', (data) => handleMessage(extWs, data.toString()));

  // クローズハンドラ
  extWs.on('close', () => {
    if (extWs.authTimeout) {
      clearTimeout(extWs.authTimeout);
    }
    cleanupConnection(extWs).catch((err) => {
      logger.error({ err }, 'クローズ時のクリーンアップエラー');
    });
  });

  // エラーハンドラ
  extWs.on('error', (error) => {
    if (extWs.authTimeout) {
      clearTimeout(extWs.authTimeout);
    }
    logger.error({ err: error }, 'WebSocketエラー');
    cleanupConnection(extWs).catch((err) => {
      logger.error({ err }, 'エラー時のクリーンアップエラー');
    });
  });
}

/**
 * メッセージハンドラ
 */
async function handleMessage(ws: ExtendedWebSocket, data: string): Promise<void> {
  try {
    const parsed = JSON.parse(data);
    const result = clientMessageSchema.safeParse(parsed);

    if (!result.success) {
      logger.warn({ errors: result.error.flatten() }, 'メッセージバリデーションエラー');
      sendError(ws, 'INVALID_MESSAGE', 'メッセージの形式が不正です');
      return;
    }

    const message = result.data;

    // authenticateメッセージ以外は認証済みでないと処理しない
    if (message.type !== 'authenticate' && !ws.userId) {
      sendError(ws, 'NOT_AUTHENTICATED', '認証が必要です');
      return;
    }

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
    }
  } catch (error) {
    logger.error({ err: error }, 'メッセージ処理エラー');
    sendError(ws, 'INVALID_MESSAGE', 'メッセージの形式が不正です');
  }
}

/**
 * 認証処理
 */
async function handleAuthenticate(ws: ExtendedWebSocket, token: string): Promise<void> {
  // 認証済みの場合は再認証を拒否
  if (ws.userId) {
    sendError(ws, 'ALREADY_AUTHENTICATED', '既に認証済みです');
    return;
  }

  // 認証試行回数の制限（ブルートフォース対策）
  ws.authAttempts++;
  if (ws.authAttempts > MAX_AUTH_ATTEMPTS) {
    logger.warn({ authAttempts: ws.authAttempts }, '認証試行回数の上限に達しました');
    sendError(ws, 'TOO_MANY_ATTEMPTS', '認証試行回数の上限に達しました');
    ws.close();
    return;
  }

  const user = await authenticateToken(token);

  if (!user) {
    sendError(ws, 'AUTHENTICATION_FAILED', '認証に失敗しました');
    return;
  }

  // 認証タイムアウトをクリア
  if (ws.authTimeout) {
    clearTimeout(ws.authTimeout);
    ws.authTimeout = undefined;
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
/**
 * チャンネル名のフォーマットを検証
 */
function isValidChannel(channel: string): boolean {
  return CHANNEL_PATTERN.test(channel);
}

/**
 * ユーザーがチャンネルにアクセス可能か検証
 * user:チャンネルは自分自身のIDのみ許可
 */
function isAuthorizedForChannel(ws: ExtendedWebSocket, channel: string): boolean {
  // user:チャンネルは自分のIDのみ許可
  if (channel.startsWith('user:')) {
    const targetUserId = channel.slice('user:'.length);
    return targetUserId === ws.userId;
  }

  // その他のチャンネル（project, test_suite等）はフォーマット検証済みなら許可
  // NOTE: プロジェクトレベルの認可はAPI経由で担保する
  return true;
}

async function handleSubscribe(ws: ExtendedWebSocket, channels: string[]): Promise<void> {
  const subscribedChannels: string[] = [];

  for (const channel of channels) {
    // チャンネル名のフォーマット検証
    if (!isValidChannel(channel)) {
      logger.warn({ channel, userId: ws.userId }, '不正なチャンネル名');
      continue;
    }

    // 認可チェック
    if (!isAuthorizedForChannel(ws, channel)) {
      logger.warn({ channel, userId: ws.userId }, 'チャンネルへのアクセス権限なし');
      continue;
    }

    // チャンネルにサブスクライブ
    if (!channelSubscribers.has(channel)) {
      const subscribed = await subscribeToChannel(channel);
      if (!subscribed) {
        logger.warn({ channel, userId: ws.userId }, 'Redisサブスクライブ失敗のためチャンネルをスキップ');
        continue;
      }
      channelSubscribers.set(channel, new Set());
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
    // JSONとして有効であることを確認（不正なデータのブロードキャストを防止）
    JSON.parse(message);
    const subscribers = channelSubscribers.get(channel);

    if (subscribers) {
      for (const ws of subscribers) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Redisメッセージ処理エラー');
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
      logger.info('WebSocketサーバーを終了しました');
      resolve();
    });
  });
}
