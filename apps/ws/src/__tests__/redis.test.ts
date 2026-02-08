import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoistedでモック関数を先に定義（vi.mockのホイスティング対策）
const { mockLogger, mockPublish, mockSubscribe, mockUnsubscribe, mockQuit, mockDisconnect, mockOn } = vi.hoisted(() => {
  const mockLogger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn(), fatal: vi.fn(), child: vi.fn() };
  mockLogger.child.mockReturnValue(mockLogger);
  return {
    mockLogger,
    mockPublish: vi.fn().mockResolvedValue(1),
    mockSubscribe: vi.fn().mockResolvedValue(1),
    mockUnsubscribe: vi.fn().mockResolvedValue(1),
    mockQuit: vi.fn().mockResolvedValue('OK'),
    mockDisconnect: vi.fn(),
    mockOn: vi.fn(),
  };
});

vi.mock('../utils/logger.js', () => ({ logger: mockLogger }));
vi.mock('../config.js', () => ({
  env: { REDIS_URL: 'redis://localhost:6379' },
}));
vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    quit: mockQuit,
    disconnect: mockDisconnect,
    on: mockOn,
  })),
}));

import { publishEvent, subscribeToChannel, unsubscribeFromChannel, closeRedis } from '../redis.js';

describe('redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('publishEvent', () => {
    it('正常にイベントをパブリッシュ', async () => {
      const event = { type: 'test', data: 'hello' };

      await publishEvent('test-channel', event);

      expect(mockPublish).toHaveBeenCalledWith('test-channel', JSON.stringify(event));
    });

    it('Redis障害時にエラーをログに記録し、例外を投げない', async () => {
      mockPublish.mockRejectedValueOnce(new Error('Connection refused'));

      // 例外が投げられないことを確認
      await expect(publishEvent('test-channel', { type: 'test' })).resolves.not.toThrow();

      // エラーがログに記録されることを確認
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), channel: 'test-channel' },
        'イベントのパブリッシュに失敗しました'
      );
    });

    it('連続した障害でも呼び出しごとにgracefulに処理', async () => {
      mockPublish
        .mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce(1);

      await expect(publishEvent('ch1', { type: 'test' })).resolves.not.toThrow();
      await expect(publishEvent('ch2', { type: 'test' })).resolves.not.toThrow();
      await expect(publishEvent('ch3', { type: 'test' })).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribeToChannel', () => {
    it('正常にチャンネルにサブスクライブしtrueを返す', async () => {
      const result = await subscribeToChannel('test-channel');

      expect(mockSubscribe).toHaveBeenCalledWith('test-channel');
      expect(result).toBe(true);
    });

    it('Redis障害時にエラーをログに記録しfalseを返す', async () => {
      mockSubscribe.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await subscribeToChannel('test-channel');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), channel: 'test-channel' },
        'チャンネルのサブスクライブに失敗しました'
      );
    });
  });

  describe('unsubscribeFromChannel', () => {
    it('正常にチャンネルからアンサブスクライブ', async () => {
      await unsubscribeFromChannel('test-channel');

      expect(mockUnsubscribe).toHaveBeenCalledWith('test-channel');
    });

    it('Redis障害時にエラーをログに記録し、例外を投げない', async () => {
      mockUnsubscribe.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(unsubscribeFromChannel('test-channel')).resolves.not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error), channel: 'test-channel' },
        'チャンネルのアンサブスクライブに失敗しました'
      );
    });
  });

  describe('closeRedis', () => {
    it('正常にquitで終了', async () => {
      await closeRedis();

      expect(mockQuit).toHaveBeenCalledTimes(2);
      expect(mockDisconnect).not.toHaveBeenCalled();
    });

    it('Publisher のquit失敗時にdisconnectにフォールバック', async () => {
      mockQuit
        .mockRejectedValueOnce(new Error('Publisher quit failed'))
        .mockResolvedValueOnce('OK');

      await expect(closeRedis()).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Redis Publisher のquitに失敗、強制切断します'
      );
      // publisherのdisconnectが呼ばれる
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('Subscriber のquit失敗時にdisconnectにフォールバック', async () => {
      mockQuit
        .mockResolvedValueOnce('OK')
        .mockRejectedValueOnce(new Error('Subscriber quit failed'));

      await expect(closeRedis()).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Redis Subscriber のquitに失敗、強制切断します'
      );
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('両方のquit失敗時に両方ともdisconnectにフォールバック', async () => {
      mockQuit
        .mockRejectedValueOnce(new Error('Publisher quit failed'))
        .mockRejectedValueOnce(new Error('Subscriber quit failed'));

      await expect(closeRedis()).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
      expect(mockDisconnect).toHaveBeenCalledTimes(2);
    });

    it('disconnect自体が失敗してもエラーをログに記録して継続', async () => {
      mockQuit.mockRejectedValueOnce(new Error('Publisher quit failed'));
      mockDisconnect.mockImplementationOnce(() => {
        throw new Error('Publisher disconnect failed');
      });
      // subscriberのquitは成功
      mockQuit.mockResolvedValueOnce('OK');

      await expect(closeRedis()).resolves.not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Redis Publisher のquitに失敗、強制切断します'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: expect.any(Error) },
        'Redis Publisher のdisconnectにも失敗しました'
      );
    });
  });
});
