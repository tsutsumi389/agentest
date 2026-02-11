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
  subscribeToChannel: vi.fn().mockResolvedValue(true),
  unsubscribeFromChannel: vi.fn().mockResolvedValue(undefined),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

// 認証モジュールのモック
vi.mock('../../auth.js', () => ({
  authenticateToken: vi.fn(),
  authenticateFromCookie: vi.fn(),
}));

// プレゼンスハンドラのモック
vi.mock('../../handlers/presence.js', () => ({
  handlePresenceJoin: vi.fn().mockResolvedValue(undefined),
  handlePresenceLeave: vi.fn().mockResolvedValue(undefined),
}));

// config モジュールのモック（共有定数を使用）
// 注意: test-helpers.jsが../../config.jsを直接・間接的にインポートしないこと
vi.mock('../../config.js', async () => {
  const { TEST_ENV_CONFIG } = await import('./test-helpers.js');
  return { env: TEST_ENV_CONFIG };
});

// ============================================
// インポート
// ============================================

import { authenticateToken, authenticateFromCookie } from '../../auth.js';
import { subscribeToChannel } from '../../redis.js';
import { createWebSocketServer } from '../../server.js';
import {
  TEST_USER_ID,
  TEST_PROJECT_ID,
  VALID_TOKEN,
  INVALID_TOKEN,
  testUser,
  testUser2,
  waitForMessage,
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
    // クッキー認証はデフォルトでnull（テスト内で個別にオーバーライド）
    vi.mocked(authenticateFromCookie).mockResolvedValue(null);
  });

  afterEach(async () => {
    await closeAllClients(clients);
    clients = [];
  });

  // ------------------------------------------
  // 認証テスト
  // ------------------------------------------

  it('authenticateメッセージによるWebSocket認証', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve());
      ws.on('error', reject);
    });

    expect(ws.readyState).toBe(WebSocket.OPEN);

    // authenticateメッセージで認証
    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

    const message = await waitForMessage(ws, 'authenticated') as {
      type: string;
      userId: string;
      timestamp: number;
    };

    expect(message.type).toBe('authenticated');
    expect(message.userId).toBe(TEST_USER_ID);
    expect(message.timestamp).toBeTypeOf('number');
  });

  it('URLにトークンを含めても認証されない（セキュリティ対策）', async () => {
    const ws = new WebSocket(`${serverUrl}/?token=${VALID_TOKEN}`);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // URLにトークンがあっても自動認証されない
    // subscribeを試みて未認証エラーを確認
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

  it('未認証状態でのsubscribe拒否', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // 認証せずにsubscribeを試みてエラーを確認
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

  it('無効なトークンでのauthenticate拒否', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // 無効なトークンでauthenticateメッセージを送信
    sendMessage(ws, {
      type: 'authenticate',
      token: INVALID_TOKEN,
      timestamp: Date.now(),
    });

    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
    };

    expect(errorMsg.code).toBe('AUTHENTICATION_FAILED');
  });

  it('接続切断時のクリーンアップ', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

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
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

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
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

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
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

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
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

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
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

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
    const ws1 = new WebSocket(serverUrl);
    clients.push(ws1);

    // ユーザー2の接続
    const ws2 = new WebSocket(serverUrl);
    clients.push(ws2);

    // 両方の接続確立を待つ
    await Promise.all([
      new Promise<void>((resolve) => { ws1.on('open', resolve); }),
      new Promise<void>((resolve) => { ws2.on('open', resolve); }),
    ]);

    // authenticateメッセージで認証
    sendMessage(ws1, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });
    sendMessage(ws2, {
      type: 'authenticate',
      token: 'valid-token-user2',
      timestamp: Date.now(),
    });

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

  // ------------------------------------------
  // セキュリティテスト
  // ------------------------------------------

  it('未認証状態でのpingは拒否される', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // 認証せずにpingを送信
    sendMessage(ws, { type: 'ping', timestamp: Date.now() });

    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
    };

    expect(errorMsg.code).toBe('NOT_AUTHENTICATED');
  });

  it('認証済みの場合は再認証を拒否', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // 最初の認証
    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

    await waitForMessage(ws, 'authenticated');

    // 再認証を試行
    sendMessage(ws, {
      type: 'authenticate',
      token: 'valid-token-user2',
      timestamp: Date.now(),
    });

    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
    };

    expect(errorMsg.code).toBe('ALREADY_AUTHENTICATED');
  });

  it('認証試行回数の上限を超えると切断される', async () => {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // 6回の認証試行（上限5回を超える）
    for (let i = 0; i < 6; i++) {
      sendMessage(ws, {
        type: 'authenticate',
        token: INVALID_TOKEN,
        timestamp: Date.now(),
      });
    }

    // TOO_MANY_ATTEMPTSエラーを受信
    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
    };

    // AUTHENTICATION_FAILED または TOO_MANY_ATTEMPTS のいずれかを受信
    // （最初の5回はAUTHENTICATION_FAILED、6回目はTOO_MANY_ATTEMPTSで切断）
    expect(['AUTHENTICATION_FAILED', 'TOO_MANY_ATTEMPTS']).toContain(errorMsg.code);

    // 接続が切断されるのを待つ
    await new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve();
      } else {
        ws.on('close', () => resolve());
      }
    });

    expect(ws.readyState).toBe(WebSocket.CLOSED);
  });

  // ------------------------------------------
  // クッキー認証テスト
  // ------------------------------------------

  it('クッキーによるWebSocket自動認証', async () => {
    // クッキー認証が成功するようにモック
    vi.mocked(authenticateFromCookie).mockResolvedValue(testUser);

    const ws = new WebSocket(serverUrl, {
      headers: { cookie: `access_token=${VALID_TOKEN}` },
    });
    clients.push(ws);

    // open前にメッセージリスナーを登録（サーバーが先にauthenticatedを送信するため）
    const message = await waitForMessage(ws, 'authenticated') as {
      type: string;
      userId: string;
      timestamp: number;
    };

    expect(message.type).toBe('authenticated');
    expect(message.userId).toBe(TEST_USER_ID);
    expect(authenticateFromCookie).toHaveBeenCalledWith(`access_token=${VALID_TOKEN}`);
  });

  it('クッキー認証成功時にユーザーチャンネルが自動購読される', async () => {
    vi.mocked(authenticateFromCookie).mockResolvedValue(testUser);

    const ws = new WebSocket(serverUrl, {
      headers: { cookie: `access_token=${VALID_TOKEN}` },
    });
    clients.push(ws);

    // open前にメッセージリスナーを登録
    await waitForMessage(ws, 'authenticated');

    // 自動購読の処理が完了するまで少し待つ
    await wait(100);

    // Redisにuser:チャンネルが購読されたことを確認
    expect(subscribeToChannel).toHaveBeenCalledWith(`user:${TEST_USER_ID}`);
  });

  it('クッキー認証失敗時はメッセージ認証にフォールバック', async () => {
    // クッキー認証が失敗するようにモック
    vi.mocked(authenticateFromCookie).mockResolvedValue(null);

    const ws = new WebSocket(serverUrl, {
      headers: { cookie: 'access_token=invalid-token' },
    });
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // クッキー認証失敗後、authenticateメッセージで認証
    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

    const message = await waitForMessage(ws, 'authenticated') as {
      type: string;
      userId: string;
    };

    expect(message.type).toBe('authenticated');
    expect(message.userId).toBe(TEST_USER_ID);
  });

  it('メッセージ認証成功時にもユーザーチャンネルが自動購読される', async () => {
    // クッキー認証なし（クッキーヘッダーなし）
    vi.mocked(authenticateFromCookie).mockResolvedValue(null);

    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    sendMessage(ws, {
      type: 'authenticate',
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

    await waitForMessage(ws, 'authenticated');

    // 自動購読の処理が完了するまで少し待つ
    await wait(100);

    // Redisにuser:チャンネルが購読されたことを確認
    expect(subscribeToChannel).toHaveBeenCalledWith(`user:${TEST_USER_ID}`);
  });

  it('クッキー認証済みの場合は再度のauthenticateメッセージを拒否', async () => {
    vi.mocked(authenticateFromCookie).mockResolvedValue(testUser);

    const ws = new WebSocket(serverUrl, {
      headers: { cookie: `access_token=${VALID_TOKEN}` },
    });
    clients.push(ws);

    // open前にメッセージリスナーを登録
    await waitForMessage(ws, 'authenticated');

    // 既にクッキーで認証済みの状態でauthenticateメッセージを送信
    sendMessage(ws, {
      type: 'authenticate',
      token: 'valid-token-user2',
      timestamp: Date.now(),
    });

    const errorMsg = await waitForMessage(ws, 'error') as {
      type: string;
      code: string;
    };

    expect(errorMsg.code).toBe('ALREADY_AUTHENTICATED');
  });
});
