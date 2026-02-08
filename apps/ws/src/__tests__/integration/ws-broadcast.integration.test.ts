import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import type { WebSocketServer } from 'ws';

// ============================================
// モックの設定（インポートより先に定義する必要がある）
// ============================================

// Redisモジュールのモック（サブスクライバーのメッセージハンドラを取得可能にする）
let capturedRedisMessageHandler: ((channel: string, message: string) => void) | null = null;

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
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === 'message') {
        capturedRedisMessageHandler = handler as (channel: string, message: string) => void;
      }
    }),
  },
  publishEvent: vi.fn().mockResolvedValue(undefined),
  subscribeToChannel: vi.fn().mockResolvedValue(true),
  unsubscribeFromChannel: vi.fn().mockResolvedValue(undefined),
  closeRedis: vi.fn().mockResolvedValue(undefined),
}));

// 認証モジュールのモック
vi.mock('../../auth.js', () => ({
  authenticateToken: vi.fn(),
}));

// プレゼンスハンドラのモック
vi.mock('../../handlers/presence.js', () => ({
  handlePresenceJoin: vi.fn().mockResolvedValue(undefined),
  handlePresenceLeave: vi.fn().mockResolvedValue(undefined),
}));

// configモジュールのモック（共有定数を使用）
// 注意: test-helpers.jsが../../config.jsを直接・間接的にインポートしないこと
vi.mock('../../config.js', async () => {
  const { TEST_ENV_CONFIG } = await import('./test-helpers.js');
  return { env: TEST_ENV_CONFIG };
});

// ============================================
// インポート
// ============================================

import { authenticateToken } from '../../auth.js';
import { createWebSocketServer, broadcastToChannel, sendToUser } from '../../server.js';
import {
  TEST_USER_ID,
  TEST_USER_ID_2,
  TEST_PROJECT_ID,
  TEST_SUITE_ID,
  TEST_EXECUTION_ID,
  TEST_LOCK_ID,
  VALID_TOKEN,
  testUser,
  testUser2,
  testUser3,
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

describe('WebSocketブロードキャスト 統合テスト', () => {
  let wss: WebSocketServer;
  let serverPort: number;
  let serverUrl: string;
  let clients: WebSocket[];

  beforeAll(async () => {
    // 認証モックの初期設定
    vi.mocked(authenticateToken).mockImplementation(async (token: string) => {
      if (token === VALID_TOKEN) return testUser;
      if (token === 'valid-token-user2') return testUser2;
      if (token === 'valid-token-user3') return testUser3;
      return null;
    });

    // ポート0でサーバーを起動
    wss = createWebSocketServer(0, '127.0.0.1');

    // サーバーがlistening状態になるまで待機
    await new Promise<void>((resolve) => {
      if (wss.address()) {
        resolve();
      } else {
        wss.on('listening', () => resolve());
      }
    });

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
    // 認証モックを再設定
    vi.mocked(authenticateToken).mockImplementation(async (token: string) => {
      if (token === VALID_TOKEN) return testUser;
      if (token === 'valid-token-user2') return testUser2;
      if (token === 'valid-token-user3') return testUser3;
      return null;
    });
  });

  afterEach(async () => {
    await closeAllClients(clients);
    clients = [];
  });

  // ------------------------------------------
  // ヘルパー：認証済みクライアントを接続してチャネルを購読
  // ------------------------------------------
  async function connectAndSubscribe(
    token: string,
    channels: string[]
  ): Promise<WebSocket> {
    const ws = new WebSocket(serverUrl);
    clients.push(ws);

    await new Promise<void>((resolve) => {
      ws.on('open', resolve);
    });

    // authenticateメッセージで認証
    sendMessage(ws, {
      type: 'authenticate',
      token,
      timestamp: Date.now(),
    });

    await waitForMessage(ws, 'authenticated');

    if (channels.length > 0) {
      sendMessage(ws, {
        type: 'subscribe',
        channels,
        timestamp: Date.now(),
      });

      await waitForMessage(ws, 'subscribed');
    }

    return ws;
  }

  // ------------------------------------------
  // チャネル配信テスト
  // ------------------------------------------

  it('チャネル購読者へのイベント配信', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    // broadcastToChannelを使ってイベントを送信
    const event = {
      type: 'test_suite:updated' as const,
      eventId: 'test-event-1',
      timestamp: Date.now(),
      testSuiteId: TEST_SUITE_ID,
      projectId: TEST_PROJECT_ID,
      changes: [{ field: 'title', oldValue: 'Old', newValue: 'New' }],
      updatedBy: { type: 'user' as const, id: TEST_USER_ID, name: 'Test User 1' },
    };

    broadcastToChannel(channel, event);

    const received = await waitForAnyMessage(ws) as { type: string; eventId: string };

    expect(received.type).toBe('test_suite:updated');
    expect(received.eventId).toBe('test-event-1');
  });

  it('プロジェクトチャネルへのイベント配信', async () => {
    const projectChannel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [projectChannel]);

    // プロジェクトチャネルにダッシュボード更新イベントを送信
    const event = {
      type: 'dashboard:updated' as const,
      eventId: 'dashboard-event-1',
      timestamp: Date.now(),
      projectId: TEST_PROJECT_ID,
      trigger: 'execution' as const,
      resourceId: TEST_EXECUTION_ID,
    };

    broadcastToChannel(projectChannel, event);

    const received = await waitForAnyMessage(ws) as { type: string; projectId: string };

    expect(received.type).toBe('dashboard:updated');
    expect(received.projectId).toBe(TEST_PROJECT_ID);
  });

  it('未購読チャネルのイベントは受信しない', async () => {
    const subscribedChannel = `project:${TEST_PROJECT_ID}`;
    const unsubscribedChannel = `project:other-project-id`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [subscribedChannel]);

    // 未購読チャネルにイベントを送信
    const event = {
      type: 'test_suite:updated' as const,
      eventId: 'test-event-unsubscribed',
      timestamp: Date.now(),
      testSuiteId: TEST_SUITE_ID,
      projectId: 'other-project-id',
      changes: [],
      updatedBy: { type: 'user' as const, id: TEST_USER_ID, name: 'Test User 1' },
    };

    broadcastToChannel(unsubscribedChannel, event);

    // メッセージが来ないことを確認
    await expectNoMessage(ws, 300);
  });

  // ------------------------------------------
  // 編集ロックイベントテスト
  // ------------------------------------------

  it('編集ロックイベント（ロック取得通知）', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    const lockEvent = {
      type: 'lock:acquired' as const,
      eventId: 'lock-event-1',
      timestamp: Date.now(),
      lockId: TEST_LOCK_ID,
      targetType: 'SUITE' as const,
      targetId: TEST_SUITE_ID,
      lockedBy: { type: 'user' as const, id: TEST_USER_ID_2, name: 'Test User 2' },
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    };

    broadcastToChannel(channel, lockEvent);

    const received = await waitForAnyMessage(ws) as {
      type: string;
      lockId: string;
      targetType: string;
      lockedBy: { id: string };
    };

    expect(received.type).toBe('lock:acquired');
    expect(received.lockId).toBe(TEST_LOCK_ID);
    expect(received.targetType).toBe('SUITE');
    expect(received.lockedBy.id).toBe(TEST_USER_ID_2);
  });

  it('編集ロックイベント（ロック解放通知）', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    const releaseEvent = {
      type: 'lock:released' as const,
      eventId: 'lock-release-event-1',
      timestamp: Date.now(),
      lockId: TEST_LOCK_ID,
      targetType: 'SUITE' as const,
      targetId: TEST_SUITE_ID,
    };

    broadcastToChannel(channel, releaseEvent);

    const received = await waitForAnyMessage(ws) as {
      type: string;
      lockId: string;
      targetType: string;
    };

    expect(received.type).toBe('lock:released');
    expect(received.lockId).toBe(TEST_LOCK_ID);
    expect(received.targetType).toBe('SUITE');
  });

  // ------------------------------------------
  // テスト実行イベントテスト
  // ------------------------------------------

  it('テスト実行状態変更通知', async () => {
    const channel = `execution:${TEST_EXECUTION_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    const executionEvent = {
      type: 'execution:started' as const,
      eventId: 'exec-event-1',
      timestamp: Date.now(),
      executionId: TEST_EXECUTION_ID,
      testSuiteId: TEST_SUITE_ID,
      environmentId: null,
      executedBy: { type: 'user' as const, id: TEST_USER_ID, name: 'Test User 1' },
    };

    broadcastToChannel(channel, executionEvent);

    const received = await waitForAnyMessage(ws) as {
      type: string;
      executionId: string;
      testSuiteId: string;
    };

    expect(received.type).toBe('execution:started');
    expect(received.executionId).toBe(TEST_EXECUTION_ID);
    expect(received.testSuiteId).toBe(TEST_SUITE_ID);
  });

  // ------------------------------------------
  // プレゼンスイベントテスト
  // ------------------------------------------

  it('プレゼンス: ユーザー参加通知', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    // プレゼンス参加イベントをbroadcastToChannelで送信
    const presenceJoinEvent = {
      type: 'presence:user_joined' as const,
      eventId: 'presence-join-1',
      timestamp: Date.now(),
      channel,
      user: {
        id: TEST_USER_ID_2,
        name: 'Test User 2',
        avatarUrl: null,
      },
    };

    broadcastToChannel(channel, presenceJoinEvent);

    const received = await waitForAnyMessage(ws) as {
      type: string;
      channel: string;
      user: { id: string; name: string };
    };

    expect(received.type).toBe('presence:user_joined');
    expect(received.channel).toBe(channel);
    expect(received.user.id).toBe(TEST_USER_ID_2);
    expect(received.user.name).toBe('Test User 2');
  });

  it('プレゼンス: ユーザー離脱通知', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    // プレゼンス離脱イベントをbroadcastToChannelで送信
    const presenceLeaveEvent = {
      type: 'presence:user_left' as const,
      eventId: 'presence-leave-1',
      timestamp: Date.now(),
      channel,
      userId: TEST_USER_ID_2,
    };

    broadcastToChannel(channel, presenceLeaveEvent);

    const received = await waitForAnyMessage(ws) as {
      type: string;
      channel: string;
      userId: string;
    };

    expect(received.type).toBe('presence:user_left');
    expect(received.channel).toBe(channel);
    expect(received.userId).toBe(TEST_USER_ID_2);
  });

  // ------------------------------------------
  // 複数クライアントへの配信テスト
  // ------------------------------------------

  it('複数クライアントへの同時配信', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    // 3つのクライアントが同じチャネルを購読
    const ws1 = await connectAndSubscribe(VALID_TOKEN, [channel]);
    const ws2 = await connectAndSubscribe('valid-token-user2', [channel]);
    const ws3 = await connectAndSubscribe('valid-token-user3', [channel]);

    // イベントをブロードキャスト
    const event = {
      type: 'test_suite:updated' as const,
      eventId: 'broadcast-all-event',
      timestamp: Date.now(),
      testSuiteId: TEST_SUITE_ID,
      projectId: TEST_PROJECT_ID,
      changes: [{ field: 'description', oldValue: 'Old desc', newValue: 'New desc' }],
      updatedBy: { type: 'user' as const, id: TEST_USER_ID, name: 'Test User 1' },
    };

    broadcastToChannel(channel, event);

    // すべてのクライアントでメッセージを受信
    const [msg1, msg2, msg3] = await Promise.all([
      waitForAnyMessage(ws1) as Promise<{ type: string; eventId: string }>,
      waitForAnyMessage(ws2) as Promise<{ type: string; eventId: string }>,
      waitForAnyMessage(ws3) as Promise<{ type: string; eventId: string }>,
    ]);

    expect(msg1.type).toBe('test_suite:updated');
    expect(msg1.eventId).toBe('broadcast-all-event');
    expect(msg2.type).toBe('test_suite:updated');
    expect(msg2.eventId).toBe('broadcast-all-event');
    expect(msg3.type).toBe('test_suite:updated');
    expect(msg3.eventId).toBe('broadcast-all-event');
  });

  // ------------------------------------------
  // sendToUser テスト
  // ------------------------------------------

  it('sendToUserで特定ユーザーにイベントを送信', async () => {
    // ユーザー1とユーザー2が接続
    const ws1 = new WebSocket(serverUrl);
    clients.push(ws1);
    const ws2 = new WebSocket(serverUrl);
    clients.push(ws2);

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

    await Promise.all([
      waitForMessage(ws1, 'authenticated'),
      waitForMessage(ws2, 'authenticated'),
    ]);

    // ユーザー1にのみイベントを送信
    const notificationEvent = {
      type: 'notification:received' as const,
      eventId: 'notif-event-1',
      timestamp: Date.now(),
      notification: {
        id: 'notif-1',
        type: 'test_completed',
        title: 'テスト完了',
        body: 'テスト実行が完了しました',
        data: null,
        createdAt: new Date().toISOString(),
      },
    };

    sendToUser(TEST_USER_ID, notificationEvent);

    // ユーザー1はメッセージを受信
    const received = await waitForAnyMessage(ws1) as { type: string; eventId: string };
    expect(received.type).toBe('notification:received');
    expect(received.eventId).toBe('notif-event-1');

    // ユーザー2はメッセージを受信しない
    await expectNoMessage(ws2, 300);
  });

  it('sendToUserで同一ユーザーの複数接続にイベント送信', async () => {
    // 同じユーザーが2つの接続を持つ
    const ws1 = new WebSocket(serverUrl);
    clients.push(ws1);
    const ws2 = new WebSocket(serverUrl);
    clients.push(ws2);

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
      token: VALID_TOKEN,
      timestamp: Date.now(),
    });

    await Promise.all([
      waitForMessage(ws1, 'authenticated'),
      waitForMessage(ws2, 'authenticated'),
    ]);

    const event = {
      type: 'notification:unread_count' as const,
      eventId: 'unread-event-1',
      timestamp: Date.now(),
      count: 5,
    };

    sendToUser(TEST_USER_ID, event);

    // 両方の接続でメッセージを受信
    const [msg1, msg2] = await Promise.all([
      waitForAnyMessage(ws1) as Promise<{ type: string; count: number }>,
      waitForAnyMessage(ws2) as Promise<{ type: string; count: number }>,
    ]);

    expect(msg1.type).toBe('notification:unread_count');
    expect(msg1.count).toBe(5);
    expect(msg2.type).toBe('notification:unread_count');
    expect(msg2.count).toBe(5);
  });

  // ------------------------------------------
  // Redis経由のブロードキャストテスト
  // ------------------------------------------

  it('Redisメッセージ受信時にチャネル購読者に配信', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    // Redisサブスクライバーのメッセージハンドラを直接呼び出す
    const event = {
      type: 'test_case:updated',
      eventId: 'redis-event-1',
      timestamp: Date.now(),
      testCaseId: 'case-123',
      testSuiteId: TEST_SUITE_ID,
      projectId: TEST_PROJECT_ID,
      changes: [{ field: 'steps', oldValue: null, newValue: 'ステップ1' }],
      updatedBy: { type: 'agent', id: 'agent-1', name: 'Test Agent' },
    };

    // capturedRedisMessageHandlerを使ってRedisメッセージをシミュレート
    if (capturedRedisMessageHandler) {
      capturedRedisMessageHandler(channel, JSON.stringify(event));
    }

    const received = await waitForAnyMessage(ws) as { type: string; eventId: string };

    expect(received.type).toBe('test_case:updated');
    expect(received.eventId).toBe('redis-event-1');
  });

  it('Redis経由の不正なJSONメッセージでエラーが発生しない', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    // 不正なJSONをRedisメッセージとして送信
    if (capturedRedisMessageHandler) {
      // これはserver.tsのhandleRedisMessage内でJSON.parseエラーになるが、
      // catchされてconsole.errorに出力されるだけ
      expect(() => {
        capturedRedisMessageHandler!(channel, '不正なJSON');
      }).not.toThrow();
    }

    // クライアントにはメッセージが配信されない
    await expectNoMessage(ws, 300);
  });

  // ------------------------------------------
  // エージェントセッションイベントテスト
  // ------------------------------------------

  it('エージェントセッション開始イベントの配信', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    const agentEvent = {
      type: 'agent:session_started' as const,
      eventId: 'agent-session-1',
      timestamp: Date.now(),
      sessionId: 'session-abc',
      projectId: TEST_PROJECT_ID,
      clientId: 'client-xyz',
      clientName: 'Claude Code',
    };

    broadcastToChannel(channel, agentEvent);

    const received = await waitForAnyMessage(ws) as {
      type: string;
      sessionId: string;
      clientName: string;
    };

    expect(received.type).toBe('agent:session_started');
    expect(received.sessionId).toBe('session-abc');
    expect(received.clientName).toBe('Claude Code');
  });

  // ------------------------------------------
  // レビューイベントテスト
  // ------------------------------------------

  it('レビューコメント追加イベントの配信', async () => {
    const channel = `test_suite:${TEST_SUITE_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    const reviewEvent = {
      type: 'review:comment_added' as const,
      eventId: 'review-event-1',
      timestamp: Date.now(),
      comment: {
        id: 'comment-1',
        targetType: 'test_suite',
        targetId: TEST_SUITE_ID,
        targetField: 'description',
        targetItemId: null,
        content: 'テストケースの説明を改善してください',
        status: 'OPEN' as const,
        author: {
          type: 'user' as const,
          id: TEST_USER_ID_2,
          name: 'Test User 2',
        },
      },
    };

    broadcastToChannel(channel, reviewEvent);

    const received = await waitForAnyMessage(ws) as {
      type: string;
      comment: { id: string; content: string };
    };

    expect(received.type).toBe('review:comment_added');
    expect(received.comment.id).toBe('comment-1');
    expect(received.comment.content).toBe('テストケースの説明を改善してください');
  });

  // ------------------------------------------
  // 購読解除後の配信テスト
  // ------------------------------------------

  it('チャネル購読解除後はイベントを受信しない', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    const ws = await connectAndSubscribe(VALID_TOKEN, [channel]);

    // チャネルを購読解除
    sendMessage(ws, {
      type: 'unsubscribe',
      channels: [channel],
      timestamp: Date.now(),
    });

    // 購読解除処理の完了を待つ
    await wait(200);

    // イベントをブロードキャスト
    const event = {
      type: 'test_suite:updated' as const,
      eventId: 'after-unsub-event',
      timestamp: Date.now(),
      testSuiteId: TEST_SUITE_ID,
      projectId: TEST_PROJECT_ID,
      changes: [],
      updatedBy: { type: 'user' as const, id: TEST_USER_ID, name: 'Test User 1' },
    };

    broadcastToChannel(channel, event);

    // メッセージを受信しないことを確認
    await expectNoMessage(ws, 300);
  });

  // ------------------------------------------
  // 切断後の配信テスト
  // ------------------------------------------

  it('切断済みクライアントにはイベントが送信されない', async () => {
    const channel = `project:${TEST_PROJECT_ID}`;

    // 2つのクライアントを接続
    const ws1 = await connectAndSubscribe(VALID_TOKEN, [channel]);
    const ws2 = await connectAndSubscribe('valid-token-user2', [channel]);

    // ws1を切断
    await closeClient(ws1);
    await wait(200);

    // イベントをブロードキャスト
    const event = {
      type: 'test_suite:updated' as const,
      eventId: 'after-disconnect-event',
      timestamp: Date.now(),
      testSuiteId: TEST_SUITE_ID,
      projectId: TEST_PROJECT_ID,
      changes: [],
      updatedBy: { type: 'user' as const, id: TEST_USER_ID, name: 'Test User 1' },
    };

    broadcastToChannel(channel, event);

    // ws2のみがメッセージを受信
    const received = await waitForAnyMessage(ws2) as { type: string; eventId: string };
    expect(received.eventId).toBe('after-disconnect-event');
  });
});
