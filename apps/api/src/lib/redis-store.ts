import { Redis } from 'ioredis';
import { env } from '../config/env.js';

// Redis接続インスタンス（遅延初期化）
let redisClient: Redis | null = null;

// 本番環境かどうか
const isProduction = env.NODE_ENV === 'production';

// Redisキーのプレフィックス
const KEY_PREFIX = {
  TOTP_SETUP: 'totp:setup:',
  TOTP_USED: 'totp:used:',
} as const;

// Redis未設定時の警告メッセージ（開発環境用）
const REDIS_NOT_CONFIGURED_WARNING =
  '[WARNING] Redis未設定: TOTPのセキュリティ機能（リプレイ攻撃対策、セットアップタイムアウト）が無効です。本番環境では必ずRedisを設定してください。';

// 警告表示フラグ（1回だけ表示）
let redisWarningShown = false;

/**
 * Redis未設定時の警告を表示（開発環境のみ、1回のみ）
 */
function warnRedisNotConfigured(): void {
  if (!redisWarningShown && !isProduction) {
    console.warn(REDIS_NOT_CONFIGURED_WARNING);
    redisWarningShown = true;
  }
}

/**
 * 本番環境でRedis必須をチェック
 * @throws Error 本番環境でRedis未設定の場合
 */
function requireRedisInProduction(): void {
  if (isProduction && !env.REDIS_URL) {
    throw new Error('本番環境ではRedisの設定が必須です（REDIS_URL環境変数）');
  }
}

/**
 * Redisクライアントを取得（未設定時はnull）
 */
export function getRedisClient(): Redis | null {
  if (!env.REDIS_URL) {
    warnRedisNotConfigured();
    return null;
  }

  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL);

    redisClient.on('connect', () => {
      console.log('[Redis Store] 接続しました');
    });

    redisClient.on('error', (error: Error) => {
      console.error('[Redis Store] エラー:', error);
    });
  }

  return redisClient;
}

/**
 * TOTPセットアップ用の秘密鍵を一時保存
 * @param adminUserId 管理者ユーザーID
 * @param secret TOTP秘密鍵
 * @param ttlSeconds 有効期限（秒）、デフォルト5分
 * @throws Error 本番環境でRedis未設定の場合
 */
export async function setTotpSetupSecret(
  adminUserId: string,
  secret: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  // 本番環境ではRedis必須
  requireRedisInProduction();

  const redis = getRedisClient();
  if (!redis) {
    // 開発環境ではフォールバック（セキュリティ低下の警告は表示済み）
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
 * @throws Error 本番環境でRedis未設定の場合
 */
export async function markTotpCodeUsed(
  adminUserId: string,
  code: string,
  ttlSeconds: number = 90
): Promise<boolean> {
  // 本番環境ではRedis必須
  requireRedisInProduction();

  const redis = getRedisClient();
  if (!redis) {
    // 開発環境ではフォールバック（セキュリティ低下の警告は表示済み）
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
 * @throws Error 本番環境でRedis未設定の場合
 */
export async function isTotpCodeUsed(
  adminUserId: string,
  code: string
): Promise<boolean> {
  // 本番環境ではRedis必須
  requireRedisInProduction();

  const redis = getRedisClient();
  if (!redis) {
    // 開発環境ではフォールバック（セキュリティ低下の警告は表示済み）
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
