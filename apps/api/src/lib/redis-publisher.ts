import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { Channels, type DashboardUpdatedEvent } from '@agentest/ws-types';
import { env } from '../config/env.js';
import { logger as baseLogger } from '../utils/logger.js';
import { getRequestId } from './request-context.js';

const logger = baseLogger.child({ module: 'redis-publisher' });

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
    publisher = new Redis(env.REDIS_URL, {
      ...(env.REDIS_URL.startsWith('rediss://') && { tls: { rejectUnauthorized: false } }),
    });

    publisher.on('connect', () => {
      logger.info('Redis Publisher (API) に接続しました');
    });

    publisher.on('error', (error: Error) => {
      logger.error({ err: error }, 'Redis Publisher (API) エラー');
    });
  }

  return publisher;
}

/**
 * イベントをパブリッシュ
 * Redis未設定時はスキップ
 */
export async function publishEvent(channel: string, event: object): Promise<void> {
  const redis = getPublisher();
  if (!redis) {
    return;
  }

  try {
    const requestId = getRequestId();
    const enrichedEvent = requestId ? { ...event, requestId } : event;
    await redis.publish(channel, JSON.stringify(enrichedEvent));
  } catch (error) {
    logger.error({ err: error }, 'Redis publish エラー');
  }
}

/**
 * ダッシュボード更新イベントを発行
 * @param projectId プロジェクトID
 * @param trigger トリガー種別
 * @param resourceId リソースID（オプション）
 */
export async function publishDashboardUpdated(
  projectId: string,
  trigger: DashboardUpdatedEvent['trigger'],
  resourceId?: string
): Promise<void> {
  const event: DashboardUpdatedEvent = {
    type: 'dashboard:updated',
    eventId: randomUUID(),
    timestamp: Date.now(),
    projectId,
    trigger,
    resourceId,
  };

  await publishEvent(Channels.project(projectId), event);
}

/**
 * Redis接続をクリーンアップ
 */
export async function closeRedisPublisher(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
}
