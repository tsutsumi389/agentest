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
  expire: vi.fn(),
  exists: vi.fn(),
};

vi.mock('../../../lib/redis.js', () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

import {
  getServerInstanceId,
  getMachineId,
  registerServerInstance,
  refreshInstanceHeartbeat,
  isInstanceAlive,
} from '../../../lib/server-instance.js';

describe('server-instance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerInstanceId', () => {
    it('UUID形式のインスタンスIDを返す', () => {
      const id = getServerInstanceId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('呼び出し毎に同じIDを返す（プロセス内で一定）', () => {
      const id1 = getServerInstanceId();
      const id2 = getServerInstanceId();
      expect(id1).toBe(id2);
    });
  });

  describe('getMachineId', () => {
    it('空でない文字列を返す', () => {
      const id = getMachineId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });
  });

  describe('registerServerInstance', () => {
    it('RedisにインスタンスIDをキーとして登録する', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await registerServerInstance();

      const instanceId = getServerInstanceId();
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `mcp:instance:${instanceId}`,
        120,
        expect.stringContaining('"machineId"')
      );
    });

    it('保存データにmachineIdとstartedAtが含まれる', async () => {
      mockRedis.setex.mockResolvedValue('OK');

      await registerServerInstance();

      const call = mockRedis.setex.mock.calls[0];
      const data = JSON.parse(call[2]);
      expect(data).toHaveProperty('machineId', getMachineId());
      expect(data).toHaveProperty('startedAt');
      // startedAtがISO文字列であることを確認
      expect(new Date(data.startedAt).toISOString()).toBe(data.startedAt);
    });

    it('Redis未接続時は何もしない（graceful degradation）', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      await registerServerInstance();

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('Redisエラー時もエラーを投げない', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      await expect(registerServerInstance()).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('refreshInstanceHeartbeat', () => {
    it('インスタンスキーのTTLを延長する', async () => {
      mockRedis.expire.mockResolvedValue(1);

      await refreshInstanceHeartbeat();

      const instanceId = getServerInstanceId();
      expect(mockRedis.expire).toHaveBeenCalledWith(
        `mcp:instance:${instanceId}`,
        120
      );
    });

    it('Redis未接続時は何もしない', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      await refreshInstanceHeartbeat();

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('Redisエラー時もエラーを投げない', async () => {
      mockRedis.expire.mockRejectedValue(new Error('Redis error'));

      await expect(refreshInstanceHeartbeat()).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('isInstanceAlive', () => {
    it('インスタンスが存在する場合はtrueを返す', async () => {
      mockRedis.exists.mockResolvedValue(1);

      const result = await isInstanceAlive('some-instance-id');

      expect(result).toBe(true);
      expect(mockRedis.exists).toHaveBeenCalledWith('mcp:instance:some-instance-id');
    });

    it('インスタンスが存在しない場合はfalseを返す', async () => {
      mockRedis.exists.mockResolvedValue(0);

      const result = await isInstanceAlive('dead-instance-id');

      expect(result).toBe(false);
    });

    it('Redis未接続時はfalseを返す', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      const result = await isInstanceAlive('some-instance-id');

      expect(result).toBe(false);
      expect(mockRedis.exists).not.toHaveBeenCalled();
    });

    it('Redisエラー時はfalseを返す', async () => {
      mockRedis.exists.mockRejectedValue(new Error('Redis error'));

      const result = await isInstanceAlive('some-instance-id');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
