import type { ClientMessage, ServerMessage, ServerEvent } from '@agentest/ws-types';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

type MessageHandler = (event: ServerEvent) => void;
type ConnectionHandler = () => void;

/**
 * WebSocketクライアント
 */
class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers = new Map<string, Set<MessageHandler>>();
  private connectHandlers = new Set<ConnectionHandler>();
  private disconnectHandlers = new Set<ConnectionHandler>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribedChannels = new Set<string>();
  private token: string | null = null;

  /**
   * WebSocket接続を確立
   */
  connect(token: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.token = token;
    this.ws = new WebSocket(`${WS_URL}?token=${token}`);

    this.ws.onopen = () => {
      console.log('WebSocket接続確立');
      this.reconnectAttempts = 0;
      this.connectHandlers.forEach((handler) => handler());

      // 購読中のチャンネルを再購読
      if (this.subscribedChannels.size > 0) {
        this.send({
          type: 'subscribe',
          channels: Array.from(this.subscribedChannels),
          timestamp: Date.now(),
        });
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerMessage | ServerEvent;
        this.handleMessage(data);
      } catch (error) {
        console.error('WebSocketメッセージのパースに失敗:', error);
      }
    };

    this.ws.onclose = () => {
      console.log('WebSocket接続が閉じられました');
      this.disconnectHandlers.forEach((handler) => handler());
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocketエラー:', error);
    };
  }

  /**
   * 再接続を試行
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('最大再接続試行回数に達しました');
      return;
    }

    if (!this.token) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`${delay}ms後に再接続を試行します (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  /**
   * 接続を切断
   */
  disconnect(): void {
    this.token = null;
    this.subscribedChannels.clear();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * メッセージを送信
   */
  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * チャンネルを購読
   */
  subscribe(channels: string[]): void {
    channels.forEach((channel) => this.subscribedChannels.add(channel));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        channels,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * チャンネルの購読を解除
   */
  unsubscribe(channels: string[]): void {
    channels.forEach((channel) => this.subscribedChannels.delete(channel));

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        channels,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * メッセージハンドラを登録
   */
  on(eventType: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(eventType)) {
      this.messageHandlers.set(eventType, new Set());
    }
    this.messageHandlers.get(eventType)!.add(handler);

    // クリーンアップ関数を返す
    return () => {
      this.messageHandlers.get(eventType)?.delete(handler);
    };
  }

  /**
   * 接続ハンドラを登録
   */
  onConnect(handler: ConnectionHandler): () => void {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  /**
   * 切断ハンドラを登録
   */
  onDisconnect(handler: ConnectionHandler): () => void {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  /**
   * 受信メッセージを処理
   */
  private handleMessage(data: ServerMessage | ServerEvent): void {
    // イベントタイプごとにハンドラを呼び出す
    const handlers = this.messageHandlers.get(data.type);
    if (handlers) {
      handlers.forEach((handler) => handler(data as ServerEvent));
    }

    // ワイルドカードハンドラ
    const wildcardHandlers = this.messageHandlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(data as ServerEvent));
    }
  }

  /**
   * 接続状態を取得
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// シングルトンインスタンス
export const wsClient = new WebSocketClient();
