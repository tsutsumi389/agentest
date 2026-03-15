import { describe, it, expect, vi, beforeEach } from 'vitest';

// ロガーのモック
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

vi.mock('../../utils/logger.js', () => ({
  logger: mockLogger,
}));

// Redisモック
const mockRedisInstance = vi.hoisted(() => ({
  publish: vi.fn().mockResolvedValue(1),
  quit: vi.fn().mockResolvedValue('OK'),
  on: vi.fn(),
}));

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => mockRedisInstance),
}));

// randomUUIDモック
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
}));

// ws-typesモック
vi.mock('@agentest/ws-types', () => ({
  Channels: {
    project: (projectId: string) => `project:${projectId}`,
  },
}));

// envモック
const mockEnv = vi.hoisted(() => ({
  REDIS_URL: 'redis://localhost:6379',
}));

vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

// request-contextモック
const { mockGetRequestId } = vi.hoisted(() => ({
  mockGetRequestId: vi.fn<() => string | undefined>().mockReturnValue(undefined),
}));

vi.mock('../../lib/request-context.js', () => ({
  getRequestId: mockGetRequestId,
}));

import {
  publishEvent,
  publishDashboardUpdated,
  closeRedisPublisher,
} from '../../lib/redis-publisher.js';

describe('redis-publisher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.REDIS_URL = 'redis://localhost:6379';
  });

  describe('publishEvent', () => {
    it('イベントをJSON文字列でpublishする', async () => {
      const event = { type: 'test', data: 'value' };
      await publishEvent('test-channel', event);

      expect(mockRedisInstance.publish).toHaveBeenCalledWith('test-channel', JSON.stringify(event));
    });

    it('REDIS_URL未設定時はスキップする', async () => {
      mockEnv.REDIS_URL = '';
      await publishEvent('channel', { test: true });
      expect(mockRedisInstance.publish).not.toHaveBeenCalled();
    });

    it('publishエラー時はエラーログを出力して処理継続する', async () => {
      mockRedisInstance.publish.mockRejectedValueOnce(new Error('publish error'));

      // エラーがスローされないことを確認
      await expect(publishEvent('channel', { test: true })).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('リクエストコンテキスト内ではイベントにrequestIdを自動注入する', async () => {
      mockGetRequestId.mockReturnValue('ctx-req-123');
      const event = { type: 'test', data: 'value' };

      await publishEvent('test-channel', event);

      const publishCall = mockRedisInstance.publish.mock.calls[0];
      const publishedEvent = JSON.parse(publishCall[1]);
      expect(publishedEvent.requestId).toBe('ctx-req-123');
      expect(publishedEvent.type).toBe('test');
      expect(publishedEvent.data).toBe('value');
    });

    it('リクエストコンテキスト外ではrequestIdを注入しない', async () => {
      mockGetRequestId.mockReturnValue(undefined);
      const event = { type: 'test', data: 'value' };

      await publishEvent('test-channel', event);

      const publishCall = mockRedisInstance.publish.mock.calls[0];
      const publishedEvent = JSON.parse(publishCall[1]);
      expect(publishedEvent.requestId).toBeUndefined();
      expect(publishedEvent.type).toBe('test');
    });
  });

  describe('publishDashboardUpdated', () => {
    it('ダッシュボード更新イベントを発行する', async () => {
      await publishDashboardUpdated('project-1', 'test_case', 'tc-1');

      expect(mockRedisInstance.publish).toHaveBeenCalledWith(
        'project:project-1',
        expect.stringContaining('"type":"dashboard:updated"')
      );
    });

    it('イベントに正しい構造を持つ', async () => {
      await publishDashboardUpdated('project-1', 'test_suite');

      const publishCall = mockRedisInstance.publish.mock.calls[0];
      const event = JSON.parse(publishCall[1]);

      expect(event).toEqual({
        type: 'dashboard:updated',
        eventId: 'test-uuid-1234',
        timestamp: expect.any(Number),
        projectId: 'project-1',
        trigger: 'test_suite',
      });
      // resourceId 未指定時はプロパティ自体が存在しないことを確認
      expect(event).not.toHaveProperty('resourceId');
    });

    it('resourceIdはオプション', async () => {
      await publishDashboardUpdated('project-1', 'test_case', 'resource-123');

      const publishCall = mockRedisInstance.publish.mock.calls[0];
      const event = JSON.parse(publishCall[1]);
      expect(event.resourceId).toBe('resource-123');
    });
  });

  describe('closeRedisPublisher', () => {
    it('Redis接続を閉じる', async () => {
      // publishEventを呼んでpublisherを初期化
      await publishEvent('init', {});
      await closeRedisPublisher();
      expect(mockRedisInstance.quit).toHaveBeenCalled();
    });
  });
});
