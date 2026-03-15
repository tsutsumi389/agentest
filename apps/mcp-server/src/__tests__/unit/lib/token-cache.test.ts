import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';

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

// envのモック
vi.mock('../../../config/env.js', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
  },
}));

// Redisクライアントのモック
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
};

vi.mock('../../../lib/redis.js', () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

import {
  getCachedTokenValidation,
  cacheTokenValidation,
  invalidateTokenCache,
} from '../../../lib/token-cache.js';

describe('token-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCachedTokenValidation', () => {
    it('キャッシュヒット時にパース済みの結果を返す', async () => {
      const cachedData = { userId: 'user-123', scopes: ['mcp:read'] };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await getCachedTokenValidation('oauth', 'test-token');

      expect(result).toEqual(cachedData);
      // キーがSHA-256ハッシュを使用していることを確認
      const expectedHash = createHash('sha256').update('test-token').digest('hex');
      expect(mockRedis.get).toHaveBeenCalledWith(`mcp:token:oauth:${expectedHash}`);
    });

    it('キャッシュミス時にnullを返す', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getCachedTokenValidation('oauth', 'test-token');

      expect(result).toBeNull();
    });

    it('APIキータイプのキープレフィックスが正しい', async () => {
      mockRedis.get.mockResolvedValue(null);

      await getCachedTokenValidation('apikey', 'agentest_abc123');

      const expectedHash = createHash('sha256').update('agentest_abc123').digest('hex');
      expect(mockRedis.get).toHaveBeenCalledWith(`mcp:token:apikey:${expectedHash}`);
    });

    it('Redisエラー時にnullを返す（graceful degradation）', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection error'));

      const result = await getCachedTokenValidation('oauth', 'test-token');

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('Redis未接続時（null）にnullを返す', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      const result = await getCachedTokenValidation('oauth', 'test-token');

      expect(result).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
    });
  });

  describe('cacheTokenValidation', () => {
    it('有効なOAuthトークン結果をキャッシュする（TTL指定あり）', async () => {
      const data = { userId: 'user-123', scopes: ['mcp:read'] };
      mockRedis.setex.mockResolvedValue('OK');

      await cacheTokenValidation('oauth', 'test-token', data, 120);

      const expectedHash = createHash('sha256').update('test-token').digest('hex');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `mcp:token:oauth:${expectedHash}`,
        120,
        JSON.stringify(data)
      );
    });

    it('TTL未指定時はデフォルト300秒を使用', async () => {
      const data = { userId: 'user-123', scopes: ['mcp:read'] };
      mockRedis.setex.mockResolvedValue('OK');

      await cacheTokenValidation('apikey', 'agentest_abc123', data);

      const expectedHash = createHash('sha256').update('agentest_abc123').digest('hex');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `mcp:token:apikey:${expectedHash}`,
        300,
        JSON.stringify(data)
      );
    });

    it('Redisエラー時もエラーを投げない（graceful degradation）', async () => {
      mockRedis.setex.mockRejectedValue(new Error('Redis error'));

      // エラーが投げられないことを確認
      await expect(
        cacheTokenValidation('oauth', 'test-token', { userId: 'u1', scopes: [] }, 60)
      ).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('Redis未接続時は何もしない', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      await cacheTokenValidation('oauth', 'test-token', { userId: 'u1', scopes: [] }, 60);

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });
  });

  describe('invalidateTokenCache', () => {
    it('指定されたトークンのキャッシュを削除する', async () => {
      mockRedis.del.mockResolvedValue(1);

      await invalidateTokenCache('oauth', 'test-token');

      const expectedHash = createHash('sha256').update('test-token').digest('hex');
      expect(mockRedis.del).toHaveBeenCalledWith(`mcp:token:oauth:${expectedHash}`);
    });

    it('APIキータイプのキャッシュを削除する', async () => {
      mockRedis.del.mockResolvedValue(1);

      await invalidateTokenCache('apikey', 'agentest_abc123');

      const expectedHash = createHash('sha256').update('agentest_abc123').digest('hex');
      expect(mockRedis.del).toHaveBeenCalledWith(`mcp:token:apikey:${expectedHash}`);
    });

    it('Redisエラー時もエラーを投げない（graceful degradation）', async () => {
      mockRedis.del.mockRejectedValue(new Error('Redis error'));

      await expect(invalidateTokenCache('oauth', 'test-token')).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('Redis未接続時は何もしない', async () => {
      const { getRedisClient } = await import('../../../lib/redis.js');
      vi.mocked(getRedisClient).mockReturnValueOnce(null);

      await invalidateTokenCache('oauth', 'test-token');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });
});
