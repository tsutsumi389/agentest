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

publisher.on('ready', () => {
  logger.info('Redis Publisher が準備完了しました');
});

subscriber.on('connect', () => {
  logger.info('Redis Subscriber に接続しました');
});

subscriber.on('error', (error: Error) => {
  logger.error({ err: error }, 'Redis Subscriber エラー');
});

subscriber.on('ready', () => {
  logger.info('Redis Subscriber が準備完了しました');
});

/**
 * イベントをパブリッシュ
 * Redis障害時はエラーをログに記録し、例外を飲み込んでgracefulに継続
 */
export async function publishEvent(channel: string, event: object): Promise<void> {
  try {
    await publisher.publish(channel, JSON.stringify(event));
  } catch (error) {
    logger.error({ err: error, channel }, 'イベントのパブリッシュに失敗しました');
  }
}

/**
 * チャンネルにサブスクライブ
 * Redis障害時はエラーをログに記録し、falseを返す
 * 呼び出し元はfalse時にローカル状態の整合性を保つ必要がある
 */
export async function subscribeToChannel(channel: string): Promise<boolean> {
  try {
    await subscriber.subscribe(channel);
    return true;
  } catch (error) {
    logger.error({ err: error, channel }, 'チャンネルのサブスクライブに失敗しました');
    return false;
  }
}

/**
 * チャンネルからアンサブスクライブ
 * Redis障害時はエラーをログに記録し、例外を飲み込んでgracefulに継続
 */
export async function unsubscribeFromChannel(channel: string): Promise<void> {
  try {
    await subscriber.unsubscribe(channel);
  } catch (error) {
    logger.error({ err: error, channel }, 'チャンネルのアンサブスクライブに失敗しました');
  }
}

/**
 * Redis接続をクリーンアップ
 * quit失敗時はdisconnect（強制切断）にフォールバック
 */
export async function closeRedis(): Promise<void> {
  // Publisher のクリーンアップ
  try {
    await publisher.quit();
  } catch (error) {
    logger.warn({ err: error }, 'Redis Publisher のquitに失敗、強制切断します');
    try {
      publisher.disconnect();
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, 'Redis Publisher のdisconnectにも失敗しました');
    }
  }

  // Subscriber のクリーンアップ
  try {
    await subscriber.quit();
  } catch (error) {
    logger.warn({ err: error }, 'Redis Subscriber のquitに失敗、強制切断します');
    try {
      subscriber.disconnect();
    } catch (disconnectError) {
      logger.error({ err: disconnectError }, 'Redis Subscriber のdisconnectにも失敗しました');
    }
  }
}
