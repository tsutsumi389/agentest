import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { WebSocketServer } from 'ws';

// ============================================
// モックの設定（インポートより先に定義する必要がある）
// ============================================

// Redisモジュールのモック
vi.mock('../../redis.js', () => ({
  publisher: {
    publish: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn().mockReturnThis(),
  },
  subscriber: {
    subscribe: vi.fn().mockResolvedValue(1),
    unsubscribe: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn().mockReturnThis(),
  },
  publishEvent: vi.fn().mockResolvedValue(undefined),
  subscribeToChannel: vi.fn().mockResolvedValue(undefined),
  unsubscribeFromChannel: vi.fn().mockResolvedValue(undefined),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

// 認証モジュールのモック
vi.mock('../../auth.js', () => ({
  authenticateToken: vi.fn(),
  extractTokenFromUrl: vi.fn((url: string) => {
    try {
      const urlObj = new URL(url, 'ws://localhost');
      return urlObj.searchParams.get('token');
    } catch {
      return null;
    }
  }),
}));

// プレゼンスハンドラのモック
vi.mock('../../handlers/presence.js', () => ({
  handlePresenceJoin: vi.fn().mockResolvedValue(undefined),
  handlePresenceLeave: vi.fn().mockResolvedValue(undefined),
}));

// config モジュールのモック（共有定数を使用）
vi.mock('../../config.js', async () => {
  const { TEST_ENV_CONFIG } = await import('./test-helpers.js');
  return { env: TEST_ENV_CONFIG };
});

// ============================================
// インポート
// ============================================

import { authenticateToken } from '../../auth.js';
import { createWebSocketServer } from '../../server.js';
import {
  TEST_USER_ID,
  TEST_PROJECT_ID,
  VALID_TOKEN,
  INVALID_TOKEN,
  testUser,
  testUser2,
  waitForMessage,
  waitForAnyMessage,
  expectNoMessage,
  sendMessage,
  closeClient,
  closeAllClients,
  closeServer,
  wait,
} from './test-helpers.js';

// ============================================
// テスト本体
// ============================================

describe('WebSocket接続 統合テスト', () => {
  let wss: WebSocketServer;
  let serverPort: number;
  let serverUrl: string;
  let clients: WebSocket[];

  beforeAll(async () => {
    // 認証モックの初期設定
    vi.mocked(authenticateToken).mockImplementation(async (token: string) => {
      if (token === VALID_TOKEN) return testUser;
      if (token === 'valid-token-user2') return testUser2;
      return null;
    });

    // ポート0でサーバーを起動（OSが空きポートを割り当てる）
    wss = createWebSocketServer(0, '127.0.0.1');

    // サーバーがlistening状態になるまで待機
    await new Promise<void>((resolve) => {
      if (wss.address()) {
        resolve();
      } else {
        wss.on('listening', () => resolve());
      }
    });

    // サーバーのアドレス情報を取得
    const address = wss.address();
    if (typeof address === 'object' && address !== null) {
      serverPort = address.port;
      serverUrl = `ws://127.0.0.1:${serverPort}`;
    }
  });

  afterAll(async () => {
    await closeServer(wss);
  });

  beforeEach(() => {
    clients = [];
    vi.clearAllMocks();
    // 認証モックを再設定（clearAllMocksでクリアされるため）
    vi.mocked(authenticateToken).mockImplementation(async (token: string) => {
      if (token === VALID_TOKEN) return testUser;
      if (token === 'valid-token-user2') return testUser2;
      return null;
    });
  });

  afterEach(async () => {
    await closeAllClients(clients);
    clients = [];
  });

  // ------------------------------------------
  // 認証テスト
  // ------------------------------------------

  it('認証済みWebSocket接続の確立', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('authenticatedメッセージの受信確認', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    const messagePromise = waitForMessage(ws, 'authenticated');

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    const message = await messagePromise as {
      type: string;
      userId: string;
      timestamp: number;
    };

    expect(message.type).toBe('authenticated');
    expect(message.userId).toBe(TEST_USER_ID);
    expect(message.timestamp).toBeTypeOf('number');
  });

  it('未認証接続の拒否（トークンなし）', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // トークンなしの接続は確立されるが、authenticatedメッセージは送信されない
    // 認証メッセージを手動で送信してエラーを確認
    sendMessage(ws, {
      type: 'subscribe',
      channels: [`project:${TEST_PROJECT_ID}`],
      timestamp: Date.now(),
    });

    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
      message: string;
    };

    expect(errorMsg.type).toBe('error');
    expect(errorMsg.code).toBe('NOT_AUTHENTICATED');
  });

  it('無効なトークンでの接続拒否', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${INVALID_TOKEN}`);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // 無効なトークンでは認証されない
    // subscribeを試みてエラーを確認
    await wait(100); // サーバーの認証処理を待つ

    sendMessage(ws, {
      type: 'subscribe',
      channels: [`project:${TEST_PROJECT_ID}`],
      timestamp: Date.now(),
    });

    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
    };

    expect(errorMsg.code).toBe('NOT_AUTHENTICATED');
  });

  it('接続切断時のクリーンアップ', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await waitForMessage(ws, 'authenticated');

    // 切断前のクライアント数を確認
    const clientCountBefore = wss.clients.size;
    expect(clientCountBefore).toBeGreaterThanOrEqual(1);

    // クライアントを切断
    await closeClient(ws);

    // クライアントリストから削除されるまで待つ
    await wait(200);

    // 切断後はクライアント数が減少する
    expect(wss.clients.size).toBeLessThan(clientCountBefore);
  });

  // ------------------------------------------
  // ハートビートテスト
  // ------------------------------------------

  it('ping/pongハートビート動作', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await waitForMessage(ws, 'authenticated');

    // クライアントからpingメッセージを送信
    sendMessage(ws, { type: 'ping', timestamp: Date.now() });

    // pongレスポンスを受信
    const pongMsg = await waitForMessage(ws, 'pong') as {
      type: string;
      timestamp: number;
    };

    expect(pongMsg.type).toBe('pong');
    expect(pongMsg.timestamp).toBeTypeOf('number');
  });

  // ------------------------------------------
  // サブスクリプションテスト
  // ------------------------------------------

  it('subscribeメッセージでチャネル購読', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await waitForMessage(ws, 'authenticated');

    const channels = [`project:${TEST_PROJECT_ID}`];
    sendMessage(ws, {
      type: 'subscribe',
      channels,
      timestamp: Date.now(),
    });

    const subscribedMsg = await waitForMessage(ws, 'subscribed') as {
      type: string;
      channels: string[];
      timestamp: number;
    };

    expect(subscribedMsg.type).toBe('subscribed');
    expect(subscribedMsg.channels).toEqual(channels);
    expect(subscribedMsg.timestamp).toBeTypeOf('number');
  });

  it('unsubscribeメッセージでチャネル購読解除', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await waitForMessage(ws, 'authenticated');

    const channels = [`project:${TEST_PROJECT_ID}`];

    // まず購読
    sendMessage(ws, {
      type: 'subscribe',
      channels,
      timestamp: Date.now(),
    });
    await waitForMessage(ws, 'subscribed');

    // 購読解除
    sendMessage(ws, {
      type: 'unsubscribe',
      channels,
      timestamp: Date.now(),
    });

    // 解除後にエラーが返らないことを確認
    // 少し待ってエラーメッセージがないことを確認
    await expectNoMessage(ws, 300);
  });

  it('subscribedレスポンスの確認', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await waitForMessage(ws, 'authenticated');

    const channels = [
      `project:${TEST_PROJECT_ID}`,
      `test_suite:${TEST_PROJECT_ID}`,
    ];

    sendMessage(ws, {
      type: 'subscribe',
      channels,
      timestamp: Date.now(),
    });

    const subscribedMsg = await waitForMessage(ws, 'subscribed') as {
      type: string;
      channels: string[];
    };

    // 複数チャンネルの購読を確認
    expect(subscribedMsg.channels).toHaveLength(2);
    expect(subscribedMsg.channels).toContain(`project:${TEST_PROJECT_ID}`);
    expect(subscribedMsg.channels).toContain(`test_suite:${TEST_PROJECT_ID}`);
  });

  // ------------------------------------------
  // エラーハンドリングテスト
  // ------------------------------------------

  it('無効なメッセージフォーマットのエラーハンドリング', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await waitForMessage(ws, 'authenticated');

    // 不正なJSON文字列を送信
    ws.send('これはJSONではない');

    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
      message: string;
    };

    expect(errorMsg.type).toBe('error');
    expect(errorMsg.code).toBe('INVALID_MESSAGE');
  });

  // ------------------------------------------
  // 同時接続テスト
  // ------------------------------------------

  it('複数クライアント同時接続', async () => {
    // ユーザー1の接続
    const ws1 = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws1);

    // ユーザー2の接続
    const ws2 = new WebSocket(`${serverUrl}/?token=valid-token-user2`);
    clients.push(ws2);

    // 両方の認証メッセージを並行して待つ
    const [auth1, auth2] = await Promise.all([
      waitForMessage(ws1, 'authenticated') as Promise<{ type: string; userId: string }>,
      waitForMessage(ws2, 'authenticated') as Promise<{ type: string; userId: string }>,
    ]);

    expect(auth1.userId).toBe(testUser.id);
    expect(auth2.userId).toBe(testUser2.id);

    // 両方の接続が有効であることを確認
    expect(ws1.readyState).toBe(WebSocket.OPEN);
    expect(ws2.readyState).toBe(WebSocket.OPEN);

    // 各クライアントが独立してpingに応答することを確認
    sendMessage(ws1, { type: 'ping', timestamp: Date.now() });
    sendMessage(ws2, { type: 'ping', timestamp: Date.now() });

    const [pong1, pong2] = await Promise.all([
      waitForMessage(ws1, 'pong'),
      waitForMessage(ws2, 'pong'),
    ]);

    expect(pong1).toBeDefined();
    expect(pong2).toBeDefined();
  });
});
