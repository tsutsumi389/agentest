import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// loggerのモック
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
      trace: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return { mockLogger };
});

vi.mock('../../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// agentSessionServiceのモック
const mockAgentSessionService = vi.hoisted(() => ({
  processTimedOutSessions: vi.fn(),
}));

vi.mock('../../../services/agent-session.service.js', () => ({
  agentSessionService: mockAgentSessionService,
  SESSION_CONFIG: {
    HEARTBEAT_INTERVAL: 30,
    HEARTBEAT_TIMEOUT: 60,
  },
}));

// モック設定後にインポート
import { heartbeatService } from '../../../services/heartbeat.service.js';

describe('HeartbeatService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // サービスを停止してクリーンな状態にする
    heartbeatService.stop();
  });

  afterEach(() => {
    heartbeatService.stop();
    vi.useRealTimers();
  });

  describe('start', () => {
    it('サービスを開始するとアクティブになる', () => {
      heartbeatService.start(1000);

      expect(heartbeatService.isActive()).toBe(true);
    });

    it('開始時に即座にタイムアウトチェックを実行', async () => {
      mockAgentSessionService.processTimedOutSessions.mockResolvedValue(0);

      heartbeatService.start(1000);

      // 非同期処理を進める（setIntervalがあるのでrunOnlyPendingTimersAsyncを使用）
      await vi.runOnlyPendingTimersAsync();

      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalled();
    });

    it('指定間隔でタイムアウトチェックを実行', async () => {
      mockAgentSessionService.processTimedOutSessions.mockResolvedValue(0);

      heartbeatService.start(1000); // 1秒間隔

      // 初回実行（start直後に即座に1回実行される）
      // runOnlyPendingTimersAsyncはsetIntervalを1回分進めることがあるため、
      // 厳密な回数ではなく相対的な増加をテストする
      await vi.runOnlyPendingTimersAsync();
      const initialCount = mockAgentSessionService.processTimedOutSessions.mock.calls.length;
      expect(initialCount).toBeGreaterThanOrEqual(1);

      // 1秒進める → interval分の1回増加
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalledTimes(initialCount + 1);

      // もう1秒進める → さらに1回増加
      await vi.advanceTimersByTimeAsync(1000);
      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalledTimes(initialCount + 2);
    });

    it('すでに起動中の場合は警告して何もしない', () => {
      heartbeatService.start(1000);
      heartbeatService.start(1000);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ハートビートサービスは既に起動しています'
      );
    });

    it('タイムアウトチェックでエラーが発生してもクラッシュしない', async () => {
      mockAgentSessionService.processTimedOutSessions.mockRejectedValue(
        new Error('Database error')
      );

      heartbeatService.start(1000);

      // エラーが発生しても継続
      await vi.runOnlyPendingTimersAsync();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'ハートビートチェックエラー'
      );
    });
  });

  describe('stop', () => {
    it('サービスを停止するとアクティブでなくなる', () => {
      heartbeatService.start(1000);
      heartbeatService.stop();

      expect(heartbeatService.isActive()).toBe(false);
    });

    it('停止後はタイムアウトチェックが実行されない', async () => {
      mockAgentSessionService.processTimedOutSessions.mockResolvedValue(0);

      heartbeatService.start(1000);
      await vi.runOnlyPendingTimersAsync();

      // 初回実行を確認
      const callCount = mockAgentSessionService.processTimedOutSessions.mock.calls.length;

      heartbeatService.stop();

      // 時間を進めてもこれ以上呼ばれない
      await vi.advanceTimersByTimeAsync(5000);

      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalledTimes(
        callCount
      );
    });

    it('起動していない状態で停止しても問題ない', () => {
      expect(() => heartbeatService.stop()).not.toThrow();
    });
  });

  describe('isActive', () => {
    it('起動前はfalse', () => {
      expect(heartbeatService.isActive()).toBe(false);
    });

    it('起動後はtrue', () => {
      heartbeatService.start(1000);
      expect(heartbeatService.isActive()).toBe(true);
    });

    it('停止後はfalse', () => {
      heartbeatService.start(1000);
      heartbeatService.stop();
      expect(heartbeatService.isActive()).toBe(false);
    });
  });
});
