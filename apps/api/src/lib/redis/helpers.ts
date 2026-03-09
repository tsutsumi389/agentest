import { getRedisClient, scanKeys } from './client.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'redis-store' });

/**
 * キャッシュにデータを保存する汎用関数
 * @param key キャッシュキー
 * @param data 保存するデータ
 * @param ttlSeconds 有効期限（秒）
 * @param errorMessage エラー時のログメッセージ
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds: number,
  errorMessage: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
    return true;
  } catch (error) {
    logger.error({ err: error }, errorMessage);
    return false;
  }
}

/**
 * キャッシュからデータを取得する汎用関数
 * @param key キャッシュキー
 * @param errorMessage エラー時のログメッセージ
 */
export async function getCache<T>(
  key: string,
  errorMessage: string
): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const data = await redis.get(key);
    if (!data) {
      return null;
    }
    // NOTE: ランタイム型チェックなし。呼び出し元が正しい型パラメータを指定する前提
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error({ err: error }, errorMessage);
    return null;
  }
}

/**
 * キャッシュを無効化する汎用関数
 * @param key キャッシュキー
 * @param errorMessage エラー時のログメッセージ
 */
export async function invalidateCache(
  key: string,
  errorMessage: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error({ err: error }, errorMessage);
    return false;
  }
}

/**
 * パターンマッチでキャッシュを無効化する汎用関数（SCAN使用）
 * @param pattern キーパターン（例: "admin:users:*"）
 * @param errorMessage エラー時のログメッセージ
 */
export async function invalidateCacheByPattern(
  pattern: string,
  errorMessage: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const keys = await scanKeys(redis, pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    logger.error({ err: error }, errorMessage);
    return false;
  }
}

/**
 * 検索パラメータからソート済みキャッシュキーを生成する汎用関数
 * @param prefix キープレフィックス
 * @param params 検索パラメータ
 */
export function generateParamsKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${prefix}${sortedParams}`;
}
