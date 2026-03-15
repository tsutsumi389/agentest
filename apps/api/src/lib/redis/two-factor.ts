import { getRedisClient, requireRedisInProduction, KEY_PREFIX } from './client.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'redis-store' });

/**
 * 2FA認証用の一時トークンを保存
 * トークンをキー、ユーザーIDを値として保存する
 * @param userId ユーザーID
 * @param token 一時トークン（crypto.randomBytesで生成）
 * @param ttlSeconds 有効期限（秒）、デフォルト5分
 * @throws Error 本番環境でRedis未設定の場合
 */
export async function setUserTwoFactorToken(
  userId: string,
  token: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  requireRedisInProduction();

  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.USER_2FA_TOKEN}${token}`;
    await redis.setex(key, ttlSeconds, userId);
    return true;
  } catch (error) {
    logger.error({ err: error, userId }, 'ユーザー2FA一時トークンの保存に失敗');
    return false;
  }
}

/**
 * 2FA認証用の一時トークンからユーザーIDを取得
 * @param token 一時トークン
 */
export async function getUserIdByTwoFactorToken(token: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const key = `${KEY_PREFIX.USER_2FA_TOKEN}${token}`;
    return await redis.get(key);
  } catch (error) {
    logger.error({ err: error }, 'ユーザー2FA一時トークンからのユーザーID取得に失敗');
    return null;
  }
}

/**
 * 2FA認証用の一時トークンを削除
 * @param token 一時トークン
 */
export async function deleteUserTwoFactorToken(token: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.USER_2FA_TOKEN}${token}`;
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error({ err: error }, 'ユーザー2FA一時トークンの削除に失敗');
    return false;
  }
}
