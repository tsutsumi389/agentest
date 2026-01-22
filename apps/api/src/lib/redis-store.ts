import { Redis } from 'ioredis';
import { env } from '../config/env.js';

// Redis接続インスタンス（遅延初期化）
let redisClient: Redis | null = null;

// Redisキーのプレフィックス
const KEY_PREFIX = {
  TOTP_SETUP: 'totp:setup:',
  TOTP_USED: 'totp:used:',
} as const;

/**
 * Redisクライアントを取得（未設定時はnull）
 */
export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL);

    redisClient.on('connect', () => {
      console.log('✅ Redis Store に接続しました');
    });

    redisClient.on('error', (error: Error) => {
      console.error('❌ Redis Store エラー:', error);
    });
  }

  return redisClient;
}

/**
 * TOTPセットアップ用の秘密鍵を一時保存
 * @param adminUserId 管理者ユーザーID
 * @param secret TOTP秘密鍵
 * @param ttlSeconds 有効期限（秒）、デフォルト5分
 */
export async function setTotpSetupSecret(
  adminUserId: string,
  secret: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    console.warn('Redis未設定のため、TOTPセットアップ秘密鍵を保存できません');
    return false;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_SETUP}${adminUserId}`;
    await redis.setex(key, ttlSeconds, secret);
    return true;
  } catch (error) {
    console.error('TOTP秘密鍵の保存に失敗:', error);
    return false;
  }
}

/**
 * TOTPセットアップ用の秘密鍵を取得
 * @param adminUserId 管理者ユーザーID
 */
export async function getTotpSetupSecret(
  adminUserId: string
): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_SETUP}${adminUserId}`;
    return await redis.get(key);
  } catch (error) {
    console.error('TOTP秘密鍵の取得に失敗:', error);
    return null;
  }
}

/**
 * TOTPセットアップ用の秘密鍵を削除
 * @param adminUserId 管理者ユーザーID
 */
export async function deleteTotpSetupSecret(
  adminUserId: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_SETUP}${adminUserId}`;
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('TOTP秘密鍵の削除に失敗:', error);
    return false;
  }
}

/**
 * TOTPコードを使用済みとしてマーク（リプレイ攻撃対策）
 * @param adminUserId 管理者ユーザーID
 * @param code TOTPコード
 * @param ttlSeconds 有効期限（秒）、デフォルト90秒
 */
export async function markTotpCodeUsed(
  adminUserId: string,
  code: string,
  ttlSeconds: number = 90
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis未設定時は常にfalseを返す（リプレイ対策なし）
    console.warn('Redis未設定のため、TOTPコードの使用済みマークをスキップ');
    return false;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_USED}${adminUserId}:${code}`;
    // NXオプション: キーが存在しない場合のみ設定
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    // 設定に成功した場合は 'OK'、キーが既に存在する場合はnull
    return result === 'OK';
  } catch (error) {
    console.error('TOTPコードの使用済みマークに失敗:', error);
    return false;
  }
}

/**
 * TOTPコードが使用済みかどうかを確認
 * @param adminUserId 管理者ユーザーID
 * @param code TOTPコード
 */
export async function isTotpCodeUsed(
  adminUserId: string,
  code: string
): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis未設定時は未使用として扱う
    return false;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_USED}${adminUserId}:${code}`;
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    console.error('TOTPコードの使用済み確認に失敗:', error);
    return false;
  }
}

/**
 * Redis接続をクリーンアップ
 */
export async function closeRedisStore(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
