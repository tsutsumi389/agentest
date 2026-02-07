import { Redis } from 'ioredis';
import { env } from './config.js';
import { logger as baseLogger } from './utils/logger.js';

const logger = baseLogger.child({ module: 'redis' });

// パブリッシャー用Redisクライアント
export const publisher = new Redis(env.REDIS_URL);

// サブスクライバー用Redisクライアント
export const subscriber = new Redis(env.REDIS_URL);

// 接続イベントハンドラ
publisher.on('connect', () => {
  logger.info('Redis Publisher に接続しました');
});

publisher.on('error', (error: Error) => {
  logger.error({ err: error }, 'Redis Publisher エラー');
});

subscriber.on('connect', () => {
  logger.info('Redis Subscriber に接続しました');
});

subscriber.on('error', (error: Error) => {
  logger.error({ err: error }, 'Redis Subscriber エラー');
});

/**
 * イベントをパブリッシュ
 */
export async function publishEvent(channel: string, event: object): Promise<void> {
  await publisher.publish(channel, JSON.stringify(event));
}

/**
 * チャンネルにサブスクライブ
 */
export async function subscribeToChannel(channel: string): Promise<void> {
  await subscriber.subscribe(channel);
}

/**
 * チャンネルからアンサブスクライブ
 */
export async function unsubscribeFromChannel(channel: string): Promise<void> {
  await subscriber.unsubscribe(channel);
}

/**
 * Redis接続をクリーンアップ
 */
export async function closeRedis(): Promise<void> {
  await publisher.quit();
  await subscriber.quit();
}
