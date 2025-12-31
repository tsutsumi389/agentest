import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

      // 非同期処理を進める
      await vi.runAllTimersAsync();

      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalled();
    });

    it('指定間隔でタイムアウトチェックを実行', async () => {
      mockAgentSessionService.processTimedOutSessions.mockResolvedValue(0);

      heartbeatService.start(1000); // 1秒間隔

      // 初回実行
      await vi.runAllTimersAsync();
      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalledTimes(1);

      // 1秒進める
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalledTimes(2);

      // もう1秒進める
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();
      expect(mockAgentSessionService.processTimedOutSessions).toHaveBeenCalledTimes(3);
    });

    it('すでに起動中の場合は警告して何もしない', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      heartbeatService.start(1000);
      heartbeatService.start(1000);

      expect(consoleSpy).toHaveBeenCalledWith(
        'ハートビートサービスは既に起動しています'
      );

      consoleSpy.mockRestore();
    });

    it('タイムアウトチェックでエラーが発生してもクラッシュしない', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAgentSessionService.processTimedOutSessions.mockRejectedValue(
        new Error('Database error')
      );

      heartbeatService.start(1000);

      // エラーが発生しても継続
      await vi.runAllTimersAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'ハートビートチェックエラー:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
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
      await vi.runAllTimersAsync();

      // 初回実行を確認
      const callCount = mockAgentSessionService.processTimedOutSessions.mock.calls.length;

      heartbeatService.stop();

      // 時間を進めてもこれ以上呼ばれない
      vi.advanceTimersByTime(5000);
      await vi.runAllTimersAsync();

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
