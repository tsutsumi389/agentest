/**
 * Redisクライアント初期化
 */
import { Redis } from 'ioredis';

let redisClient: Redis | null = null;

/**
 * Redisクライアントを取得
 * REDIS_URLが設定されていない場合はnullを返す
 */
export function getRedisClient(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn('[Jobs] REDIS_URLが設定されていません');
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl);
    redisClient.on('connect', () => {
      console.log('[Jobs] Redisに接続しました');
    });
    redisClient.on('error', (error: Error) => {
      console.error('[Jobs] Redisエラー:', error);
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
    console.log('[Jobs] Redis接続をクローズしました');
  }
}
