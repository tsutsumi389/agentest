import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TEST_PROJECT_ID,
  TEST_SUITE_ID,
  TEST_CASE_ID,
  TEST_LOCK_ID,
  TEST_USER_ID,
} from '../helpers.js';

// crypto.randomUUIDをモック
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-event-uuid',
});

// Redisモジュールをモック
vi.mock('../../redis.js', () => ({
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

import { publishEvent } from '../../redis.js';
import {
  publishLockAcquired,
  publishLockReleased,
  publishLockExpired,
} from '../../handlers/lock.js';

describe('handlers/lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishLockAcquired', () => {
    it('SUITEのロック取得イベントをプロジェクトとスイートチャンネルにパブリッシュ', async () => {
      const expiresAt = new Date('2026-02-03T12:00:00Z');
      const lockedBy = { type: 'user' as const, id: TEST_USER_ID, name: 'Test User' };

      await publishLockAcquired(
        TEST_LOCK_ID,
        'SUITE',
        TEST_SUITE_ID,
        TEST_PROJECT_ID,
        lockedBy,
        expiresAt
      );

      expect(publishEvent).toHaveBeenCalledTimes(2);

      // プロジェクトチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `project:${TEST_PROJECT_ID}`,
        expect.objectContaining({
          type: 'lock:acquired',
          lockId: TEST_LOCK_ID,
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
          lockedBy,
          expiresAt: '2026-02-03T12:00:00.000Z',
        })
      );

      // スイートチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `test_suite:${TEST_SUITE_ID}`,
        expect.objectContaining({
          type: 'lock:acquired',
          lockId: TEST_LOCK_ID,
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
        })
      );
    });

    it('CASEのロック取得イベントをプロジェクトとケースチャンネルにパブリッシュ', async () => {
      const expiresAt = new Date('2026-02-03T12:00:00Z');
      const lockedBy = { type: 'agent' as const, id: 'agent-1', name: 'Test Agent' };

      await publishLockAcquired(
        TEST_LOCK_ID,
        'CASE',
        TEST_CASE_ID,
        TEST_PROJECT_ID,
        lockedBy,
        expiresAt
      );

      expect(publishEvent).toHaveBeenCalledTimes(2);

      // ケースチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `test_case:${TEST_CASE_ID}`,
        expect.objectContaining({
          type: 'lock:acquired',
          targetType: 'CASE',
          targetId: TEST_CASE_ID,
        })
      );
    });

    it('イベントにeventIdとtimestampが含まれる', async () => {
      const expiresAt = new Date();
      const lockedBy = { type: 'user' as const, id: TEST_USER_ID, name: 'Test User' };

      await publishLockAcquired(
        TEST_LOCK_ID,
        'SUITE',
        TEST_SUITE_ID,
        TEST_PROJECT_ID,
        lockedBy,
        expiresAt
      );

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventId: 'test-event-uuid',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('publishLockReleased', () => {
    it('SUITEのロック解放イベントをパブリッシュ', async () => {
      await publishLockReleased(TEST_LOCK_ID, 'SUITE', TEST_SUITE_ID, TEST_PROJECT_ID);

      expect(publishEvent).toHaveBeenCalledTimes(2);

      // プロジェクトチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `project:${TEST_PROJECT_ID}`,
        expect.objectContaining({
          type: 'lock:released',
          lockId: TEST_LOCK_ID,
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
        })
      );

      // スイートチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `test_suite:${TEST_SUITE_ID}`,
        expect.objectContaining({
          type: 'lock:released',
        })
      );
    });

    it('CASEのロック解放イベントをパブリッシュ', async () => {
      await publishLockReleased(TEST_LOCK_ID, 'CASE', TEST_CASE_ID, TEST_PROJECT_ID);

      expect(publishEvent).toHaveBeenCalledTimes(2);

      expect(publishEvent).toHaveBeenCalledWith(
        `test_case:${TEST_CASE_ID}`,
        expect.objectContaining({
          type: 'lock:released',
          targetType: 'CASE',
          targetId: TEST_CASE_ID,
        })
      );
    });

    it('イベントにeventIdとtimestampが含まれる', async () => {
      await publishLockReleased(TEST_LOCK_ID, 'SUITE', TEST_SUITE_ID, TEST_PROJECT_ID);

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventId: 'test-event-uuid',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('publishLockExpired', () => {
    it('SUITEのロック期限切れイベントをパブリッシュ', async () => {
      await publishLockExpired(TEST_LOCK_ID, 'SUITE', TEST_SUITE_ID, TEST_PROJECT_ID);

      expect(publishEvent).toHaveBeenCalledTimes(2);

      // プロジェクトチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `project:${TEST_PROJECT_ID}`,
        expect.objectContaining({
          type: 'lock:expired',
          lockId: TEST_LOCK_ID,
          targetType: 'SUITE',
          targetId: TEST_SUITE_ID,
        })
      );

      // スイートチャンネルへのパブリッシュを確認
      expect(publishEvent).toHaveBeenCalledWith(
        `test_suite:${TEST_SUITE_ID}`,
        expect.objectContaining({
          type: 'lock:expired',
        })
      );
    });

    it('CASEのロック期限切れイベントをパブリッシュ', async () => {
      await publishLockExpired(TEST_LOCK_ID, 'CASE', TEST_CASE_ID, TEST_PROJECT_ID);

      expect(publishEvent).toHaveBeenCalledTimes(2);

      expect(publishEvent).toHaveBeenCalledWith(
        `test_case:${TEST_CASE_ID}`,
        expect.objectContaining({
          type: 'lock:expired',
          targetType: 'CASE',
          targetId: TEST_CASE_ID,
        })
      );
    });

    it('イベントにeventIdとtimestampが含まれる', async () => {
      await publishLockExpired(TEST_LOCK_ID, 'SUITE', TEST_SUITE_ID, TEST_PROJECT_ID);

      expect(publishEvent).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          eventId: 'test-event-uuid',
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('パブリッシュ失敗時の動作', () => {
    it('一部のパブリッシュが失敗してもPromise.allSettledで処理される', async () => {
      // 1回目は成功、2回目は失敗
      vi.mocked(publishEvent)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Redis error'));

      // Promise.allSettledを使用しているのでエラーにならない
      await expect(
        publishLockAcquired(
          TEST_LOCK_ID,
          'SUITE',
          TEST_SUITE_ID,
          TEST_PROJECT_ID,
          { type: 'user', id: TEST_USER_ID, name: 'Test User' },
          new Date()
        )
      ).resolves.not.toThrow();
    });
  });
});
