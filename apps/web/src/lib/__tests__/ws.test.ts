import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { wsClient as WsClientType } from '../ws.js';

// ブラウザのWebSocketをモック
const mockWsInstances: MockWsInstance[] = [];

interface MockWsInstance {
  url: string;
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}

function createMockWsClass() {
  return vi.fn().mockImplementation((url: string) => {
    const instance: MockWsInstance = {
      url,
      readyState: 0, // CONNECTING
      send: vi.fn(),
      close: vi.fn().mockImplementation(function (this: MockWsInstance) {
        this.readyState = 3; // CLOSED
        if (this.onclose) {
          this.onclose(new CloseEvent('close'));
        }
      }),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    mockWsInstances.push(instance);
    return instance;
  });
}

// WebSocketのstaticプロパティ
const OPEN = 1;

vi.stubGlobal('WebSocket', Object.assign(createMockWsClass(), {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// import.meta.envのモック
vi.stubGlobal('import', { meta: { env: { VITE_WS_URL: 'ws://test:3002' } } });

describe('WebSocketClient', () => {
  let wsClient: typeof WsClientType;

  beforeEach(async () => {
    vi.useFakeTimers();
    mockWsInstances.length = 0;
    // モジュールを毎回リセットしてシングルトンをクリア
    vi.resetModules();
    // WebSocketモックを再設定
    vi.stubGlobal('WebSocket', Object.assign(createMockWsClass(), {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    }));
    const mod = await import('../ws.js');
    wsClient = mod.wsClient;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('connect (トークンあり)', () => {
    it('トークンありで接続し、authenticateメッセージを送信する', () => {
      wsClient.connect('my-token');

      expect(mockWsInstances).toHaveLength(1);

      // open イベントを発火
      const ws = mockWsInstances[0];
      ws.readyState = OPEN;
      ws.onopen?.(new Event('open'));

      // authenticateメッセージが送信される
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"authenticate"')
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"token":"my-token"')
      );
    });
  });

  describe('connect (トークンなし - クッキー認証)', () => {
    it('トークンなしで接続し、authenticateメッセージを送信しない', () => {
      wsClient.connect();

      expect(mockWsInstances).toHaveLength(1);

      // open イベントを発火
      const ws = mockWsInstances[0];
      ws.readyState = OPEN;
      ws.onopen?.(new Event('open'));

      // authenticateメッセージは送信されない（サーバーがクッキーで認証）
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('クッキー認証モードで再接続時もトークンなしで接続する', () => {
      wsClient.connect();

      const ws1 = mockWsInstances[0];
      ws1.readyState = OPEN;
      ws1.onopen?.(new Event('open'));

      // authenticated受信をシミュレート
      ws1.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({ type: 'authenticated', userId: 'user-1', timestamp: Date.now() }),
      }));

      // 切断
      ws1.readyState = 3;
      ws1.onclose?.(new CloseEvent('close'));

      // 再接続タイマーを進める
      vi.advanceTimersByTime(1000);

      // 再接続が試行される
      expect(mockWsInstances).toHaveLength(2);

      // 再接続もトークンなし
      const ws2 = mockWsInstances[1];
      ws2.readyState = OPEN;
      ws2.onopen?.(new Event('open'));

      // authenticateメッセージは送信されない
      expect(ws2.send).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('切断後はクッキー認証状態もリセットされる', () => {
      wsClient.connect();

      const ws1 = mockWsInstances[0];
      ws1.readyState = OPEN;
      ws1.onopen?.(new Event('open'));

      wsClient.disconnect();

      // 再接続タイマーを進めても再接続しない
      vi.advanceTimersByTime(10000);

      expect(mockWsInstances).toHaveLength(1);
    });
  });

  describe('認証エラー時の再接続停止', () => {
    it('クッキー認証モードでAUTH_TIMEOUT受信時は再接続を停止', () => {
      wsClient.connect();

      const ws1 = mockWsInstances[0];
      ws1.readyState = OPEN;
      ws1.onopen?.(new Event('open'));

      // AUTH_TIMEOUTエラーを受信
      ws1.onmessage?.(new MessageEvent('message', {
        data: JSON.stringify({ type: 'error', code: 'AUTH_TIMEOUT', message: 'Timeout', timestamp: Date.now() }),
      }));

      // 切断
      ws1.readyState = 3;
      ws1.onclose?.(new CloseEvent('close'));

      // 再接続タイマーを進めても再接続しない
      vi.advanceTimersByTime(10000);

      expect(mockWsInstances).toHaveLength(1);
    });
  });
});
