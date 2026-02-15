/**
 * Redisクライアント初期化
 */
import { Redis } from 'ioredis';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'redis' });

let redisClient: Redis | null = null;

/**
 * Redisクライアントを取得
 * REDIS_URLが設定されていない場合はnullを返す
 */
export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn('REDIS_URLが設定されていません');
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      ...(redisUrl.startsWith('rediss://') && { tls: { rejectUnauthorized: false } }),
    });
    redisClient.on('connect', () => {
      logger.info('Redisに接続しました');
    });
    redisClient.on('error', (error: Error) => {
      logger.error({ err: error }, 'Redisエラー');
    });
  }

  return redisClient;
}

/**
 * Redis接続をクローズ
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis接続をクローズしました');
  }
}
