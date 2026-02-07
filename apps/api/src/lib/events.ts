import { Channels, type TestSuiteUpdatedEvent, type TestCaseUpdatedEvent } from '@agentest/ws-types';
import { randomUUID } from 'node:crypto';
import { publishEvent } from './redis-publisher.js';
// publishEvent は内部で try-catch しエラーをログ出力するのみでスローしない設計

// 更新者の型
type UpdatedBy = { type: 'user' | 'agent'; id: string; name: string };

// 変更の型
type Change = { field: string; oldValue: unknown; newValue: unknown };

/**
 * テストスイート更新イベントを発行
 * プロジェクトチャンネルとテストスイートチャンネルの両方にパブリッシュ
 */
export async function publishTestSuiteUpdated(
  testSuiteId: string,
  projectId: string,
  changes: Change[],
  updatedBy: UpdatedBy
): Promise<void> {
  const event: TestSuiteUpdatedEvent = {
    type: 'test_suite:updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    testSuiteId,
    projectId,
    changes,
    updatedBy,
  };
  await Promise.all([
    publishEvent(Channels.project(projectId), event),
    publishEvent(Channels.testSuite(testSuiteId), event),
  ]);
}

/**
 * テストケース更新イベントを発行
 * プロジェクト、テストスイート、テストケースの3チャンネルにパブリッシュ
 */
export async function publishTestCaseUpdated(
  testCaseId: string,
  testSuiteId: string,
  projectId: string,
  changes: Change[],
  updatedBy: UpdatedBy
): Promise<void> {
  const event: TestCaseUpdatedEvent = {
    type: 'test_case:updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    testCaseId,
    testSuiteId,
    projectId,
    changes,
    updatedBy,
  };
  await Promise.all([
    publishEvent(Channels.project(projectId), event),
    publishEvent(Channels.testSuite(testSuiteId), event),
    publishEvent(Channels.testCase(testCaseId), event),
  ]);
}
