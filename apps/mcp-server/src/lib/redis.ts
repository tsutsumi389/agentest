import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'redis' });

// Redis接続インスタンス（遅延初期化）
let redisClient: Redis | null = null;

// 警告表示フラグ（1回だけ表示）
let warningShown = false;

/**
 * Redisクライアントを取得（未設定時はnull）
 * 遅延初期化パターン: 初回呼び出し時にのみ接続を作成
 */
export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    if (!warningShown) {
      logger.warn('REDIS_URL未設定: トークンキャッシュが無効です');
      warningShown = true;
    }
    return null;
  }

  if (!redisClient) {
    // キャッシュ用途のため、fail-fast設定でリクエストブロックを回避
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000,
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
 * Redis接続をクローズ（グレースフルシャットダウン用）
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis接続を終了しました');
  }
}
