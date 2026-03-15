import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  publishTestSuiteUpdated as PublishTestSuiteUpdatedFn,
  publishTestCaseUpdated as PublishTestCaseUpdatedFn,
} from '../../lib/events.js';

// redis-publisher の publishEvent をモック
const { mockPublishEvent } = vi.hoisted(() => ({
  mockPublishEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../lib/redis-publisher.js', () => ({
  publishEvent: mockPublishEvent,
}));

// randomUUIDのモック
const mockUUID = 'test-event-uuid-12345';
vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => mockUUID),
}));

// 動的インポートのためのモジュール
let publishTestSuiteUpdated: typeof PublishTestSuiteUpdatedFn;
let publishTestCaseUpdated: typeof PublishTestCaseUpdatedFn;

describe('events.ts - イベント発行ヘルパー', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // モジュールキャッシュをクリアして再インポート
    vi.resetModules();
    const eventsModule = await import('../../lib/events.js');
    publishTestSuiteUpdated = eventsModule.publishTestSuiteUpdated;
    publishTestCaseUpdated = eventsModule.publishTestCaseUpdated;
  });

  describe('publishTestSuiteUpdated', () => {
    it('2つのチャンネル（project, testSuite）にイベントを発行する', async () => {
      await publishTestSuiteUpdated(
        'suite-1',
        'project-1',
        [{ field: 'precondition:add', oldValue: null, newValue: 'precondition-1' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      expect(mockPublishEvent).toHaveBeenCalledTimes(2);

      // プロジェクトチャンネルへの発行
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'project:project-1',
        expect.objectContaining({ type: 'test_suite:updated' })
      );

      // テストスイートチャンネルへの発行
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'test_suite:suite-1',
        expect.objectContaining({ type: 'test_suite:updated' })
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

      const publishedEvent = mockPublishEvent.mock.calls[0][1];

      expect(publishedEvent).toMatchObject({
        type: 'test_suite:updated',
        eventId: mockUUID,
        testSuiteId: 'suite-1',
        projectId: 'project-1',
        changes: [
          { field: 'precondition:update', oldValue: 'old content', newValue: 'new content' },
        ],
        updatedBy: { type: 'user', id: 'user-1', name: 'Test User' },
      });

      expect(publishedEvent.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(publishedEvent.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });

  describe('publishTestCaseUpdated', () => {
    it('3つのチャンネル（project, testSuite, testCase）にイベントを発行する', async () => {
      await publishTestCaseUpdated(
        'case-1',
        'suite-1',
        'project-1',
        [{ field: 'precondition:add', oldValue: null, newValue: 'precondition-1' }],
        { type: 'user', id: 'user-1', name: 'Test User' }
      );

      expect(mockPublishEvent).toHaveBeenCalledTimes(3);

      expect(mockPublishEvent).toHaveBeenCalledWith(
        'project:project-1',
        expect.objectContaining({ type: 'test_case:updated' })
      );

      expect(mockPublishEvent).toHaveBeenCalledWith(
        'test_suite:suite-1',
        expect.objectContaining({ type: 'test_case:updated' })
      );

      expect(mockPublishEvent).toHaveBeenCalledWith(
        'test_case:case-1',
        expect.objectContaining({ type: 'test_case:updated' })
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

      const publishedEvent = mockPublishEvent.mock.calls[0][1];

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
  });
});
