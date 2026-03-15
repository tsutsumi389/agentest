import { getRedisClient, requireRedisInProduction, KEY_PREFIX } from './client.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'redis-store' });

// ============================================
// 管理者TOTP関連
// ============================================

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
    logger.error({ err: error }, 'TOTP秘密鍵の保存に失敗');
    return false;
  }
}

/**
 * TOTPセットアップ用の秘密鍵を取得
 * @param adminUserId 管理者ユーザーID
 */
export async function getTotpSetupSecret(adminUserId: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_SETUP}${adminUserId}`;
    return await redis.get(key);
  } catch (error) {
    logger.error({ err: error }, 'TOTP秘密鍵の取得に失敗');
    return null;
  }
}

/**
 * TOTPセットアップ用の秘密鍵を削除
 * @param adminUserId 管理者ユーザーID
 */
export async function deleteTotpSetupSecret(adminUserId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_SETUP}${adminUserId}`;
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error({ err: error }, 'TOTP秘密鍵の削除に失敗');
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
    logger.error({ err: error }, 'TOTPコードの使用済みマークに失敗');
    return false;
  }
}

/**
 * TOTPコードが使用済みかどうかを確認
 * @param adminUserId 管理者ユーザーID
 * @param code TOTPコード
 *
 * 注: この関数は確認専用のため、Redis未設定時はfalse（未使用）を返す。
 * 本番環境でのセキュリティはmarkTotpCodeUsed側で担保される。
 */
export async function isTotpCodeUsed(adminUserId: string, code: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis未設定時はfalseを返す（安全側：後続のmarkTotpCodeUsedでエラーになる）
    return false;
  }

  try {
    const key = `${KEY_PREFIX.TOTP_USED}${adminUserId}:${code}`;
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error({ err: error }, 'TOTPコードの使用済み確認に失敗');
    return false;
  }
}

// ============================================
// ユーザーTOTP関連
// ============================================

/**
 * ユーザーTOTPセットアップ用の秘密鍵を一時保存
 * @param userId ユーザーID
 * @param secret TOTP秘密鍵
 * @param ttlSeconds 有効期限（秒）、デフォルト5分
 * @throws Error 本番環境でRedis未設定の場合
 */
export async function setUserTotpSetupSecret(
  userId: string,
  secret: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  requireRedisInProduction();

  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.USER_TOTP_SETUP}${userId}`;
    await redis.setex(key, ttlSeconds, secret);
    return true;
  } catch (error) {
    logger.error({ err: error, userId }, 'ユーザーTOTP秘密鍵の保存に失敗');
    return false;
  }
}

/**
 * ユーザーTOTPセットアップ用の秘密鍵を取得
 * @param userId ユーザーID
 */
export async function getUserTotpSetupSecret(userId: string): Promise<string | null> {
  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  try {
    const key = `${KEY_PREFIX.USER_TOTP_SETUP}${userId}`;
    return await redis.get(key);
  } catch (error) {
    logger.error({ err: error, userId }, 'ユーザーTOTP秘密鍵の取得に失敗');
    return null;
  }
}

/**
 * ユーザーTOTPセットアップ用の秘密鍵を削除
 * @param userId ユーザーID
 */
export async function deleteUserTotpSetupSecret(userId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.USER_TOTP_SETUP}${userId}`;
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error({ err: error, userId }, 'ユーザーTOTP秘密鍵の削除に失敗');
    return false;
  }
}

/**
 * ユーザーTOTPコードを使用済みとしてマーク（リプレイ攻撃対策）
 *
 * 注意: この関数はリプレイ攻撃のみを防ぐ。
 * ブルートフォース攻撃対策は呼び出し元でレート制限を実装すること。
 *
 * @param userId ユーザーID
 * @param code TOTPコード
 * @param ttlSeconds 有効期限（秒）、デフォルト90秒
 * @throws Error 本番環境でRedis未設定の場合
 */
export async function markUserTotpCodeUsed(
  userId: string,
  code: string,
  ttlSeconds: number = 90
): Promise<boolean> {
  requireRedisInProduction();

  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.USER_TOTP_USED}${userId}:${code}`;
    // NXオプション: キーが存在しない場合のみ設定
    const result = await redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } catch (error) {
    logger.error({ err: error, userId }, 'ユーザーTOTPコードの使用済みマークに失敗');
    return false;
  }
}

/**
 * ユーザーTOTPコードが使用済みかどうかを確認
 * @param userId ユーザーID
 * @param code TOTPコード
 */
export async function isUserTotpCodeUsed(userId: string, code: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    return false;
  }

  try {
    const key = `${KEY_PREFIX.USER_TOTP_USED}${userId}:${code}`;
    const result = await redis.exists(key);
    return result === 1;
  } catch (error) {
    logger.error({ err: error, userId }, 'ユーザーTOTPコードの使用済み確認に失敗');
    return false;
  }
}
