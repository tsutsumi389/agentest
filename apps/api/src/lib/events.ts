import { Channels, type TestSuiteUpdatedEvent, type TestCaseUpdatedEvent } from '@agentest/ws-types';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'events' });

// Redis Publisherインスタンス（遅延初期化）
let publisher: Redis | null = null;

/**
 * Redis Publisherを取得（未設定時はnull）
 */
function getPublisher(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!publisher) {
    publisher = new Redis(env.REDIS_URL);

    publisher.on('connect', () => {
      logger.info('Redis Publisher (Events) に接続しました');
    });

    publisher.on('error', (error: Error) => {
      logger.error({ err: error }, 'Redis Publisher (Events) エラー');
    });
  }

  return publisher;
}

/**
 * イベントをパブリッシュ
 * Redis未設定時はスキップ
 */
async function publishEvent(channel: string, event: object): Promise<void> {
  const redis = getPublisher();
  if (!redis) {
    return;
  }

  try {
    await redis.publish(channel, JSON.stringify(event));
  } catch (error) {
    logger.error({ err: error }, 'Redis publish エラー');
  }
}

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

/**
 * Redis接続をクリーンアップ
 */
export async function closeEventsPublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}
