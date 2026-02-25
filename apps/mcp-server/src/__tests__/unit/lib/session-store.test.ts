import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// Redisクライアントのモック
const mockRedis = {
  setex: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
};

vi.mock('../../../lib/redis.js', () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

// server-instanceのモック
vi.mock('../../../lib/server-instance.js', () => ({
  getServerInstanceId: vi.fn(() => 'test-instance-id'),
  getMachineId: vi.fn(() => 'test-machine-id'),
}));

import {
  saveSession,
  getSession,
  deleteSession as deleteSessionFromStore,
  refreshSessionTtl,
  type StoredSessionData,
} from '../../../lib/session-store.js';

describe('session-store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveSession', () => {
    it('セッションメタデータをRedisに保存する', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await saveSession('session-123', { userId: 'user-456' });

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'mcp:session:session-123',
        180,
        expect.any(String)
      );

      // 保存データの検証
      const savedData: StoredSessionData = JSON.parse(mockRedis.setex.mock.calls[0][2]);
      expect(savedData.userId).toBe('user-456');
      expect(savedData.instanceId).toBe('test-instance-id');
      expect(savedData.machineId).toBe('test-machine-id');
      expect(savedData.createdAt).toBeDefined();
    });

    it('Redis未接続時は何もしない', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      await saveSession('session-123', { userId: 'user-456' });

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('Redisエラー時もエラーを投げない', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(
        saveSession('session-123', { userId: 'user-456' })
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('セッションメタデータを取得する', async () => {
      const storedData: StoredSessionData = {
        userId: 'user-456',
        instanceId: 'instance-789',
        machineId: 'machine-abc',
        createdAt: '2026-02-24T12:00:00.000Z',
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(storedData));

      const result = await getSession('session-123');

      expect(result).toEqual(storedData);
      expect(mockRedis.get).toHaveBeenCalledWith('mcp:session:session-123');
    });

    it('セッションが存在しない場合はnullを返す', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getSession('nonexistent');

      expect(result).toBeNull();
    });

    it('Redis未接続時はnullを返す', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      const result = await getSession('session-123');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('Redisエラー時はnullを返す', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await getSession('session-123');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('不正なJSONの場合はnullを返しエラーログを出力', async () => {
      mockRedis.get.mockResolvedValue('not-valid-json');

      const result = await getSession('session-123');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('フィールドが欠けたデータの場合はnullを返し警告ログを出力', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: 'user-1' }));

      const result = await getSession('session-123');

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('deleteSession', () => {
    it('セッションメタデータをRedisから削除する', async () => {
      mockRedis.del.mockResolvedValue(1);

      await deleteSessionFromStore('session-123');

      expect(mockRedis.del).toHaveBeenCalledWith('mcp:session:session-123');
    });

    it('Redis未接続時は何もしない', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      await deleteSessionFromStore('session-123');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('Redisエラー時もエラーを投げない', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(
        deleteSessionFromStore('session-123')
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('refreshSessionTtl', () => {
    it('セッションのTTLを延長する', async () => {
      mockRedis.expire.mockResolvedValue(1);

      await refreshSessionTtl('session-123');

      expect(mockRedis.expire).toHaveBeenCalledWith(
        'mcp:session:session-123',
        180
      );
    });

    it('Redis未接続時は何もしない', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      await refreshSessionTtl('session-123');

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('Redisエラー時もエラーを投げない', async () => {
      mockRedis.expire.mockRejectedValue(new Error('Redis error'));

      await expect(
        refreshSessionTtl('session-123')
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
