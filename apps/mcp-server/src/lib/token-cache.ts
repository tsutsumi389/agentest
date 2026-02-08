import { createHash } from 'node:crypto';
import { getRedisClient } from './redis.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'token-cache' });

/** キャッシュ対象のトークンタイプ */
export type TokenType = 'oauth' | 'apikey';

/** デフォルトのキャッシュTTL（秒） */
const DEFAULT_TTL_SECONDS = 300;

/** キープレフィックス */
const KEY_PREFIX = {
  oauth: 'mcp:token:oauth:',
  apikey: 'mcp:token:apikey:',
} as const;

/**
 * トークンからキャッシュキーを生成
 * トークン値をそのままキーに使わず、SHA-256ハッシュを使用（セキュリティ対策）
 */
function buildCacheKey(type: TokenType, token: string): string {
  const hash = createHash('sha256').update(token).digest('hex');
  return `${KEY_PREFIX[type]}${hash}`;
}

/**
 * キャッシュからトークン検証結果を取得
 * @returns キャッシュヒット時は検証結果、ミス時またはエラー時はnull
 */
export async function getCachedTokenValidation<T>(
  type: TokenType,
  token: string,
): Promise<T | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const key = buildCacheKey(type, token);
    const data = await redis.get(key);
    if (!data) {
      return null;
    }
    return JSON.parse(data) as T;
  } catch (error) {
    logger.error({ err: error }, 'トークンキャッシュの取得に失敗');
    return null;
  }
}

/**
 * トークン検証結果をキャッシュに保存
 * @param type トークンタイプ
 * @param token 生のトークン文字列
 * @param result キャッシュする検証結果
 * @param ttlSeconds キャッシュTTL（秒）。未指定時は300秒
 */
export async function cacheTokenValidation<T>(
  type: TokenType,
  token: string,
  result: T,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const key = buildCacheKey(type, token);
    await redis.setex(key, ttlSeconds, JSON.stringify(result));
  } catch (error) {
    logger.error({ err: error }, 'トークンキャッシュの保存に失敗');
  }
}

/**
 * トークンのキャッシュを削除
 */
export async function invalidateTokenCache(
  type: TokenType,
  token: string,
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    const key = buildCacheKey(type, token);
    await redis.del(key);
  } catch (error) {
    logger.error({ err: error }, 'トークンキャッシュの削除に失敗');
  }
}
