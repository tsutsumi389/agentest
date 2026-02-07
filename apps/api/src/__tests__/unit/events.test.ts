import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  publishTestSuiteUpdated as PublishTestSuiteUpdatedFn,
  publishTestCaseUpdated as PublishTestCaseUpdatedFn,
  closeEventsPublisher as CloseEventsPublisherFn,
} from '../../lib/events.js';

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

// Redis Publisherのモック
const mockPublish = vi.fn();
const mockQuit = vi.fn();
const mockOn = vi.fn();

vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    publish: mockPublish,
    quit: mockQuit,
    on: mockOn,
  })),
}));

// 環境変数のモック
const mockEnv = vi.hoisted(() => ({
  REDIS_URL: 'redis://localhost:6379',
}));

vi.mock('../../config/env.js', () => ({
  env: mockEnv,
}));

// randomUUIDのモック
const mockUUID = 'test-event-uuid-12345';
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => mockUUID),
}));

// 動的インポートのためのモジュール
let publishTestSuiteUpdated: typeof PublishTestSuiteUpdatedFn;
let publishTestCaseUpdated: typeof PublishTestCaseUpdatedFn;
let closeEventsPublisher: typeof CloseEventsPublisherFn;

describe('events.ts - イベント発行ヘルパー', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnv.REDIS_URL = 'redis://localhost:6379';
    mockPublish.mockResolvedValue(1);
    mockQuit.mockResolvedValue('OK');

    // モジュールキャッシュをクリアして再インポート
    vi.resetModules();
    const eventsModule = await import('../../lib/events.js');
    publishTestSuiteUpdated = eventsModule.publishTestSuiteUpdated;
    publishTestCaseUpdated = eventsModule.publishTestCaseUpdated;
    closeEventsPublisher = eventsModule.closeEventsPublisher;
  });

  afterEach(async () => {
    // 各テスト後にRedis接続をクリーンアップ
    await closeEventsPublisher();
  });

  describe('publishTestSuiteUpdated', () => {
    it('REDIS_URL未設定時は何もしない', async () => {
      // 環境変数をクリアして再インポート
      vi.resetModules();
      mockEnv.REDIS_URL = '';

      const eventsModule = await import('../../lib/events.js');

      await eventsModule.publishTestSuiteUpdated(
        'suite-1',
        'project-1',
        [{ field: 'name', oldValue: 'old', newValue: 'new' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('2つのチャンネル（project, testSuite）にイベントを発行する', async () => {
      await publishTestSuiteUpdated(
        'suite-1',
        'project-1',
        [{ field: 'precondition:add', oldValue: null, newValue: 'precondition-1' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      expect(mockPublish).toHaveBeenCalledTimes(2);

      // プロジェクトチャンネルへの発行
      expect(mockPublish).toHaveBeenCalledWith(
        'project:project-1',
        expect.any(String)
      );

      // テストスイートチャンネルへの発行
      expect(mockPublish).toHaveBeenCalledWith(
        'test_suite:suite-1',
        expect.any(String)
      );
    });

    it('イベント形式が正しい（type, eventId, timestamp, changes, updatedBy）', async () => {
      const beforeTime = Date.now();

      await publishTestSuiteUpdated(
        'suite-1',
        'project-1',
        [{ field: 'precondition:update', oldValue: 'old content', newValue: 'new content' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      const afterTime = Date.now();

      // publishの第2引数（JSON文字列）をパース
      const publishedEvent = JSON.parse(mockPublish.mock.calls[0][1]);

      expect(publishedEvent).toMatchObject({
        type: 'test_suite:updated',
        eventId: mockUUID,
        testSuiteId: 'suite-1',
        projectId: 'project-1',
        changes: [{ field: 'precondition:update', oldValue: 'old content', newValue: 'new content' }],
        updatedBy: { type: 'user', id: 'user-1', name: 'Test User' },
      });

      // timestampがテスト実行時の範囲内にあることを確認
      expect(publishedEvent.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(publishedEvent.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('Redis publish失敗時はログ出力のみで例外を投げない', async () => {
      const mockError = new Error('Redis connection failed');
      mockPublish.mockRejectedValue(mockError);

      // 例外が投げられないことを確認
      await expect(
        publishTestSuiteUpdated(
          'suite-1',
          'project-1',
          [{ field: 'precondition:delete', oldValue: 'precondition-1', newValue: null }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        )
      ).resolves.toBeUndefined();

      // エラーログが出力されることを確認
      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: mockError },
        'Redis publish エラー'
      );
    });
  });

  describe('publishTestCaseUpdated', () => {
    it('REDIS_URL未設定時は何もしない', async () => {
      // 環境変数をクリアして再インポート
      vi.resetModules();
      mockEnv.REDIS_URL = '';

      const eventsModule = await import('../../lib/events.js');

      await eventsModule.publishTestCaseUpdated(
        'case-1',
        'suite-1',
        'project-1',
        [{ field: 'step:add', oldValue: null, newValue: 'step-1' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('3つのチャンネル（project, testSuite, testCase）にイベントを発行する', async () => {
      await publishTestCaseUpdated(
        'case-1',
        'suite-1',
        'project-1',
        [{ field: 'precondition:add', oldValue: null, newValue: 'precondition-1' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      expect(mockPublish).toHaveBeenCalledTimes(3);

      // プロジェクトチャンネルへの発行
      expect(mockPublish).toHaveBeenCalledWith(
        'project:project-1',
        expect.any(String)
      );

      // テストスイートチャンネルへの発行
      expect(mockPublish).toHaveBeenCalledWith(
        'test_suite:suite-1',
        expect.any(String)
      );

      // テストケースチャンネルへの発行
      expect(mockPublish).toHaveBeenCalledWith(
        'test_case:case-1',
        expect.any(String)
      );
    });

    it('イベント形式が正しい', async () => {
      const beforeTime = Date.now();

      await publishTestCaseUpdated(
        'case-1',
        'suite-1',
        'project-1',
        [
          { field: 'step:update', oldValue: 'old step', newValue: 'new step' },
          { field: 'expectedResult:add', oldValue: null, newValue: 'expected-1' },
        ],
        { type: 'agent', id: 'agent-1', name: 'AI Agent' }
      );

      const afterTime = Date.now();

      // publishの第2引数（JSON文字列）をパース
      const publishedEvent = JSON.parse(mockPublish.mock.calls[0][1]);

      expect(publishedEvent).toMatchObject({
        type: 'test_case:updated',
        eventId: mockUUID,
        testCaseId: 'case-1',
        testSuiteId: 'suite-1',
        projectId: 'project-1',
        changes: [
          { field: 'step:update', oldValue: 'old step', newValue: 'new step' },
          { field: 'expectedResult:add', oldValue: null, newValue: 'expected-1' },
        ],
        updatedBy: { type: 'agent', id: 'agent-1', name: 'AI Agent' },
      });

      expect(publishedEvent.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(publishedEvent.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('Redis publish失敗時はログ出力のみで例外を投げない', async () => {
      const mockError = new Error('Redis connection timeout');
      mockPublish.mockRejectedValue(mockError);

      // 例外が投げられないことを確認
      await expect(
        publishTestCaseUpdated(
          'case-1',
          'suite-1',
          'project-1',
          [{ field: 'step:delete', oldValue: 'step-1', newValue: null }],
          { type: 'user', id: 'user-1', name: 'Test User' }
        )
      ).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        { err: mockError },
        'Redis publish エラー'
      );
    });
  });

  describe('closeEventsPublisher', () => {
    it('Redisクライアントを終了する', async () => {
      // まずpublishでRedisクライアントを初期化
      await publishTestSuiteUpdated(
        'suite-1',
        'project-1',
        [{ field: 'name', oldValue: 'old', newValue: 'new' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      await closeEventsPublisher();

      expect(mockQuit).toHaveBeenCalled();
    });

    it('複数回呼び出しても安全', async () => {
      await closeEventsPublisher();
      await closeEventsPublisher();

      // quitは最初のpublisher初期化後の1回のみ
      // 2回目以降はpublisherがnullなので呼ばれない
      // この場合、publisherが初期化されていないためquitも呼ばれない
      expect(mockQuit).not.toHaveBeenCalled();
    });
  });
});
