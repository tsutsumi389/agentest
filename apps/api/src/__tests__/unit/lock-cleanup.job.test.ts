import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// EditLockServiceモック
const mockProcessExpiredLocks = vi.hoisted(() => vi.fn());

vi.mock('../../services/edit-lock.service.js', () => ({
  EditLockService: vi.fn().mockImplementation(() => ({
    processExpiredLocks: mockProcessExpiredLocks,
  })),
}));

import { startLockCleanupJob, stopLockCleanupJob } from '../../jobs/lock-cleanup.job.js';

describe('lock-cleanup.job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startLockCleanupJob', () => {
    it('初回実行でcleanupを即座に呼ぶ', async () => {
      mockProcessExpiredLocks.mockResolvedValue({ count: 0, locks: [] });

      const intervalId = startLockCleanupJob(30000);

      // 初回実行の非同期処理を解決するためにマイクロタスクを進める
      await vi.advanceTimersByTimeAsync(0);

      expect(mockProcessExpiredLocks).toHaveBeenCalledTimes(1);

      stopLockCleanupJob(intervalId);
    });

    it('定期的にprocessExpiredLocksを呼ぶ', async () => {
      mockProcessExpiredLocks.mockResolvedValue({ count: 0, locks: [] });

      const intervalId = startLockCleanupJob(1000);

      // 初回 + 2回のインターバル
      await vi.advanceTimersByTimeAsync(2500);

      expect(mockProcessExpiredLocks).toHaveBeenCalledTimes(3);

      stopLockCleanupJob(intervalId);
    });

    it('期限切れロックが見つかった場合はコールバックを呼ぶ', async () => {
      const expiredLocks = [
        { id: 'lock-1', targetType: 'testCase', targetId: 'tc-1' },
        { id: 'lock-2', targetType: 'testSuite', targetId: 'ts-1' },
      ];
      mockProcessExpiredLocks.mockResolvedValue({ count: 2, locks: expiredLocks });
      const onLockExpired = vi.fn().mockResolvedValue(undefined);

      const intervalId = startLockCleanupJob(30000, onLockExpired);

      // 初回実行を処理
      await vi.advanceTimersByTimeAsync(0);

      expect(onLockExpired).toHaveBeenCalledTimes(2);
      expect(onLockExpired).toHaveBeenCalledWith({
        id: 'lock-1',
        targetType: 'testCase',
        targetId: 'tc-1',
      });
      expect(onLockExpired).toHaveBeenCalledWith({
        id: 'lock-2',
        targetType: 'testSuite',
        targetId: 'ts-1',
      });

      stopLockCleanupJob(intervalId);
    });

    it('コールバックエラーが他のロック通知をブロックしない', async () => {
      const expiredLocks = [
        { id: 'lock-1', targetType: 'testCase', targetId: 'tc-1' },
        { id: 'lock-2', targetType: 'testSuite', targetId: 'ts-1' },
      ];
      mockProcessExpiredLocks.mockResolvedValue({ count: 2, locks: expiredLocks });
      const onLockExpired = vi.fn()
        .mockRejectedValueOnce(new Error('callback error'))
        .mockResolvedValueOnce(undefined);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const intervalId = startLockCleanupJob(30000, onLockExpired);

      // 初回実行を処理
      await vi.advanceTimersByTimeAsync(0);

      // 2回目のコールバックも呼ばれることを確認
      expect(onLockExpired).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      stopLockCleanupJob(intervalId);
    });

    it('processExpiredLocksのエラーを握りつぶす', async () => {
      mockProcessExpiredLocks.mockRejectedValue(new Error('db error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const intervalId = startLockCleanupJob(30000);

      // 初回実行を処理
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      stopLockCleanupJob(intervalId);
    });

    it('カスタム間隔を指定できる', async () => {
      mockProcessExpiredLocks.mockResolvedValue({ count: 0, locks: [] });

      const intervalId = startLockCleanupJob(5000);

      await vi.advanceTimersByTimeAsync(10000);

      // 初回 + 2回のインターバル
      expect(mockProcessExpiredLocks).toHaveBeenCalledTimes(3);

      stopLockCleanupJob(intervalId);
    });
  });

  describe('stopLockCleanupJob', () => {
    it('ジョブを停止する', async () => {
      mockProcessExpiredLocks.mockResolvedValue({ count: 0, locks: [] });

      const intervalId = startLockCleanupJob(1000);

      // 初回 + 1回のインターバル分進める
      await vi.advanceTimersByTimeAsync(1500);
      const callCount = mockProcessExpiredLocks.mock.calls.length;

      stopLockCleanupJob(intervalId);

      // 停止後はさらに呼ばれない
      await vi.advanceTimersByTimeAsync(5000);
      expect(mockProcessExpiredLocks).toHaveBeenCalledTimes(callCount);
    });
  });
});
