import { vi } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import type { AddressInfo } from 'net';
import type { AuthenticatedUser } from '../../auth.js';

// ============================================
// テスト用定数
// ============================================

export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_USER_ID_2 = '22222222-2222-2222-2222-222222222222';
export const TEST_USER_ID_3 = '33333333-3333-3333-3333-333333333333';
export const TEST_PROJECT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const TEST_SUITE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const TEST_EXECUTION_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const TEST_LOCK_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
export const VALID_TOKEN = 'valid-test-token';
export const INVALID_TOKEN = 'invalid-test-token';

// configモジュールモック用の共有定数
export const TEST_ENV_CONFIG = {
  NODE_ENV: 'test',
  PORT: 0,
  HOST: '127.0.0.1',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-secret-key-for-jwt-testing-32ch',
} as const;

// テスト用ユーザー
export const testUser: AuthenticatedUser = {
  id: TEST_USER_ID,
  email: 'user1@example.com',
  name: 'Test User 1',
  avatarUrl: 'https://example.com/avatar1.png',
};

export const testUser2: AuthenticatedUser = {
  id: TEST_USER_ID_2,
  email: 'user2@example.com',
  name: 'Test User 2',
  avatarUrl: null,
};

export const testUser3: AuthenticatedUser = {
  id: TEST_USER_ID_3,
  email: 'user3@example.com',
  name: 'Test User 3',
  avatarUrl: 'https://example.com/avatar3.png',
};

// ============================================
// Redisモック
// ============================================

// Redisサブスクライバーのメッセージハンドラを保持
let redisMessageHandler: ((channel: string, message: string) => void) | null = null;

export const mockSubscriber = {
  subscribe: vi.fn().mockResolvedValue(1),
  unsubscribe: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (event === 'message') {
      redisMessageHandler = handler as (channel: string, message: string) => void;
    }
    return mockSubscriber;
  }),
};

export const mockPublisher = {
  publish: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn().mockReturnThis(),
};

/**
 * Redisサブスクライバーにメッセージを送信するシミュレーション
 * サーバーがsubscriber.on('message')で登録したハンドラを呼び出す
 */
export function simulateRedisMessage(channel: string, message: string): void {
  if (redisMessageHandler) {
    redisMessageHandler(channel, message);
  }
}

/**
 * Redisメッセージハンドラをリセット
 */
export function resetRedisMessageHandler(): void {
  redisMessageHandler = null;
}

// ============================================
// モックセットアップ（vi.mockはファイル先頭で呼ばれる必要がある）
// ============================================

/**
 * authenticateTokenのモック実装を返す
 * トークンに基づいてユーザーを返す、または認証失敗を返す
 */
export function createAuthMock() {
  const tokenUserMap = new Map<string, AuthenticatedUser>();

  const authenticateToken = vi.fn(async (token: string) => {
    return tokenUserMap.get(token) || null;
  });

  const extractTokenFromUrl = vi.fn((url: string) => {
    try {
      const urlObj = new URL(url, 'ws://localhost');
      return urlObj.searchParams.get('token');
    } catch {
      return null;
    }
  });

  return {
    authenticateToken,
    extractTokenFromUrl,
    /**
     * トークンとユーザーの紐付けを登録
     */
    registerToken: (token: string, user: AuthenticatedUser) => {
      tokenUserMap.set(token, user);
    },
    /**
     * トークンの紐付けをクリア
     */
    clearTokens: () => {
      tokenUserMap.clear();
    },
  };
}

// ============================================
// サーバー管理
// ============================================

interface TestServerContext {
  wss: WebSocketServer;
  port: number;
  url: string;
  clients: WebSocket[];
}

/**
 * テスト用のWebSocketサーバーを作成して起動
 * ランダムポートを使用して競合を回避
 */
export async function createTestServer(): Promise<TestServerContext> {
  return new Promise((resolve) => {
    // ポート0を指定してOSにランダムポートを割り当てさせる
    const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' }, () => {
      const address = wss.address() as AddressInfo;
      const port = address.port;
      const url = `ws://127.0.0.1:${port}`;

      resolve({
        wss,
        port,
        url,
        clients: [],
      });
    });
  });
}

/**
 * 認証済みのWebSocketクライアント接続を作成
 * URLのクエリパラメータにトークンを付与して接続
 */
export function createAuthenticatedClient(
  serverUrl: string,
  token: string
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${serverUrl}/?token=${token}`);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('接続タイムアウト'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * トークンなしでWebSocketクライアント接続を作成
 */
export function createUnauthenticatedClient(
  serverUrl: string
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(serverUrl);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('接続タイムアウト'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// ============================================
// メッセージヘルパー
// ============================================

/**
 * WebSocketから特定のタイプのメッセージを待つ
 * タイムアウト付きでPromiseを返す
 */
export function waitForMessage<T = unknown>(
  ws: WebSocket,
  messageType: string,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error(`メッセージタイプ '${messageType}' の受信がタイムアウトしました`));
    }, timeoutMs);

    const handler = (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === messageType) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(message as T);
        }
      } catch {
        // JSONパースに失敗した場合は無視して次のメッセージを待つ
      }
    };

    ws.on('message', handler);
  });
}

/**
 * WebSocketから次のメッセージを待つ（タイプ不問）
 */
export function waitForAnyMessage<T = unknown>(
  ws: WebSocket,
  timeoutMs = 3000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeListener('message', handler);
      reject(new Error('メッセージ受信がタイムアウトしました'));
    }, timeoutMs);

    const handler = (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString());
        clearTimeout(timeout);
        ws.removeListener('message', handler);
        resolve(message as T);
      } catch {
        // JSONパースに失敗した場合は無視
      }
    };

    ws.on('message', handler);
  });
}

/**
 * 指定時間内にメッセージが来ないことを確認
 */
export function expectNoMessage(
  ws: WebSocket,
  waitMs = 500
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.removeListener('message', handler);
      resolve();
    }, waitMs);

    const handler = (data: Buffer | string) => {
      clearTimeout(timeout);
      ws.removeListener('message', handler);
      try {
        const message = JSON.parse(data.toString());
        reject(new Error(`予期しないメッセージを受信しました: ${JSON.stringify(message)}`));
      } catch {
        reject(new Error('予期しないメッセージを受信しました'));
      }
    };

    ws.on('message', handler);
  });
}

/**
 * 指定時間内にすべてのメッセージを収集
 */
export function collectMessages(
  ws: WebSocket,
  collectMs = 500
): Promise<unknown[]> {
  return new Promise((resolve) => {
    const messages: unknown[] = [];

    const handler = (data: Buffer | string) => {
      try {
        const message = JSON.parse(data.toString());
        messages.push(message);
      } catch {
        // JSONパースに失敗した場合は無視
      }
    };

    ws.on('message', handler);

    setTimeout(() => {
      ws.removeListener('message', handler);
      resolve(messages);
    }, collectMs);
  });
}

/**
 * WebSocketでJSONメッセージを送信
 */
export function sendMessage(ws: WebSocket, message: object): void {
  ws.send(JSON.stringify(message));
}

// ============================================
// クリーンアップ
// ============================================

/**
 * WebSocketクライアントを安全にクローズ
 */
export function closeClient(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      resolve();
      return;
    }

    ws.on('close', () => resolve());
    ws.close();

    // タイムアウト時は強制終了
    setTimeout(() => {
      if (ws.readyState !== WebSocket.CLOSED) {
        ws.terminate();
      }
      resolve();
    }, 2000);
  });
}

/**
 * 複数のWebSocketクライアントを安全にクローズ
 */
export async function closeAllClients(clients: WebSocket[]): Promise<void> {
  await Promise.all(clients.map(closeClient));
}

/**
 * WebSocketサーバーを安全にシャットダウン
 * 接続中のクライアントもすべて切断する
 */
export function closeServer(wss: WebSocketServer): Promise<void> {
  return new Promise((resolve) => {
    // 接続中のクライアントを終了
    wss.clients.forEach((client) => {
      client.terminate();
    });

    wss.close(() => {
      resolve();
    });

    // タイムアウト時は強制解決
    setTimeout(() => {
      resolve();
    }, 3000);
  });
}

/**
 * 短い待ち時間を入れるユーティリティ
 * イベントの伝播を待つために使用
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
