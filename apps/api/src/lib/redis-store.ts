import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'redis-store' });

/**
 * SCANコマンドでパターンにマッチするキーを収集する
 * KEYSコマンドと違い、O(N)で全体をブロックしない
 */
async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [nextCursor, foundKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    keys.push(...foundKeys);
  } while (cursor !== '0');
  return keys;
}

// Redis接続インスタンス（遅延初期化）
let redisClient: Redis | null = null;

// 本番環境かどうか
const isProduction = env.NODE_ENV === 'production';

// Redisキーのプレフィックス
const KEY_PREFIX = {
  TOTP_SETUP: 'totp:setup:',
  TOTP_USED: 'totp:used:',
  USER_TOTP_SETUP: 'user:totp:setup:',
  USER_TOTP_USED: 'user:totp:used:',
  USER_2FA_TOKEN: 'user:2fa:token:',
  ADMIN_DASHBOARD: 'admin:dashboard',
  ADMIN_USERS: 'admin:users:',
  ADMIN_USER_DETAIL: 'admin:user:detail:',
  ADMIN_ORGANIZATIONS: 'admin:organizations:',
  ADMIN_ORGANIZATION_DETAIL: 'admin:organization:detail:',
  ADMIN_AUDIT_LOGS: 'admin:audit-logs:',
  ADMIN_METRICS: 'admin:metrics:',
  USER_INVOICES: 'invoices:user:',
  ORG_INVOICES: 'invoices:org:',
  SYSTEM_ADMINS: 'admin:system-admins:',
  SYSTEM_ADMIN_DETAIL: 'admin:system-admin:detail:',
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
    logger.warn(REDIS_NOT_CONFIGURED_WARNING);
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
      logger.info('Redis Store 接続しました');
    });

    redisClient.on('error', (error: Error) => {
      logger.error({ err: error }, 'Redis Store エラー');
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
    logger.error({ err: error }, 'TOTP秘密鍵の保存に失敗');
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
    logger.error({ err: error }, 'TOTP秘密鍵の取得に失敗');
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
export async function isTotpCodeUsed(
  adminUserId: string,
  code: string
): Promise<boolean> {
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

/**
 * Redis接続をクリーンアップ
 */
export async function closeRedisStore(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
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
export async function getUserTotpSetupSecret(
  userId: string
): Promise<string | null> {
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
export async function deleteUserTotpSetupSecret(
  userId: string
): Promise<boolean> {
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
export async function isUserTotpCodeUsed(
  userId: string,
  code: string
): Promise<boolean> {
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
export async function getUserIdByTwoFactorToken(
  token: string
): Promise<string | null> {
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
export async function deleteUserTwoFactorToken(
  token: string
): Promise<boolean> {
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

// ============================================
// 管理者ダッシュボードキャッシュ
// ============================================

export async function setAdminDashboardCache<T>(
  stats: T,
  ttlSeconds: number = 300
): Promise<boolean> {
  return setCache(KEY_PREFIX.ADMIN_DASHBOARD, stats, ttlSeconds, '管理者ダッシュボードキャッシュの保存に失敗');
}

export async function getAdminDashboardCache<T>(): Promise<T | null> {
  return getCache<T>(KEY_PREFIX.ADMIN_DASHBOARD, '管理者ダッシュボードキャッシュの取得に失敗');
}

export async function invalidateAdminDashboardCache(): Promise<boolean> {
  return invalidateCache(KEY_PREFIX.ADMIN_DASHBOARD, '管理者ダッシュボードキャッシュの無効化に失敗');
}

// ============================================
// 管理者ユーザー一覧キャッシュ
// ============================================

export async function setAdminUsersCache<T>(
  params: Record<string, unknown>,
  data: T,
  ttlSeconds: number = 60
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.ADMIN_USERS, params),
    data, ttlSeconds, '管理者ユーザー一覧キャッシュの保存に失敗'
  );
}

export async function getAdminUsersCache<T>(
  params: Record<string, unknown>
): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.ADMIN_USERS, params),
    '管理者ユーザー一覧キャッシュの取得に失敗'
  );
}

// ============================================
// 管理者ユーザー詳細キャッシュ
// ============================================

export async function getAdminUserDetailCache<T>(userId: string): Promise<T | null> {
  return getCache<T>(`${KEY_PREFIX.ADMIN_USER_DETAIL}${userId}`, '管理者ユーザー詳細キャッシュの取得に失敗');
}

export async function setAdminUserDetailCache<T>(userId: string, data: T, ttlSeconds: number = 30): Promise<boolean> {
  return setCache(`${KEY_PREFIX.ADMIN_USER_DETAIL}${userId}`, data, ttlSeconds, '管理者ユーザー詳細キャッシュの保存に失敗');
}

export async function invalidateAdminUserDetailCache(userId: string): Promise<boolean> {
  return invalidateCache(`${KEY_PREFIX.ADMIN_USER_DETAIL}${userId}`, '管理者ユーザー詳細キャッシュの無効化に失敗');
}

// ============================================
// 管理者組織一覧キャッシュ
// ============================================

export async function setAdminOrganizationsCache<T>(
  params: Record<string, unknown>, data: T, ttlSeconds: number = 60
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.ADMIN_ORGANIZATIONS, params),
    data, ttlSeconds, '管理者組織一覧キャッシュの保存に失敗'
  );
}

export async function getAdminOrganizationsCache<T>(params: Record<string, unknown>): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.ADMIN_ORGANIZATIONS, params),
    '管理者組織一覧キャッシュの取得に失敗'
  );
}

export async function invalidateAdminOrganizationsCache(): Promise<boolean> {
  return invalidateCacheByPattern(`${KEY_PREFIX.ADMIN_ORGANIZATIONS}*`, '管理者組織一覧キャッシュの無効化に失敗');
}

// ============================================
// 管理者組織詳細キャッシュ
// ============================================

export async function getAdminOrganizationDetailCache<T>(organizationId: string): Promise<T | null> {
  return getCache<T>(`${KEY_PREFIX.ADMIN_ORGANIZATION_DETAIL}${organizationId}`, '管理者組織詳細キャッシュの取得に失敗');
}

export async function setAdminOrganizationDetailCache<T>(organizationId: string, data: T, ttlSeconds: number = 30): Promise<boolean> {
  return setCache(`${KEY_PREFIX.ADMIN_ORGANIZATION_DETAIL}${organizationId}`, data, ttlSeconds, '管理者組織詳細キャッシュの保存に失敗');
}

export async function invalidateAdminOrganizationDetailCache(organizationId: string): Promise<boolean> {
  return invalidateCache(`${KEY_PREFIX.ADMIN_ORGANIZATION_DETAIL}${organizationId}`, '管理者組織詳細キャッシュの無効化に失敗');
}

// ============================================
// ジェネリックキャッシュヘルパー（内部用）
// ============================================

/**
 * キャッシュにデータを保存する汎用関数
 * @param key キャッシュキー
 * @param data 保存するデータ
 * @param ttlSeconds 有効期限（秒）
 * @param errorMessage エラー時のログメッセージ
 */
async function setCache<T>(
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
async function getCache<T>(
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
async function invalidateCache(
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
async function invalidateCacheByPattern(
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
function generateParamsKey(prefix: string, params: Record<string, unknown>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .filter((key) => params[key] !== undefined && params[key] !== null)
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${prefix}${sortedParams}`;
}

// ============================================
// 請求履歴キャッシュ（個人・組織）
// ============================================

/**
 * ユーザーの請求履歴をキャッシュに保存
 * @param userId ユーザーID
 * @param data 請求履歴データ
 * @param ttlSeconds 有効期限（秒）、デフォルト5分
 */
export async function setUserInvoicesCache<T>(
  userId: string,
  data: T,
  ttlSeconds: number = 300
): Promise<boolean> {
  return setCache(
    `${KEY_PREFIX.USER_INVOICES}${userId}`,
    data,
    ttlSeconds,
    'ユーザー請求履歴キャッシュの保存に失敗:'
  );
}

/**
 * ユーザーの請求履歴をキャッシュから取得
 * @param userId ユーザーID
 */
export async function getUserInvoicesCache<T>(
  userId: string
): Promise<T | null> {
  return getCache<T>(
    `${KEY_PREFIX.USER_INVOICES}${userId}`,
    'ユーザー請求履歴キャッシュの取得に失敗:'
  );
}

/**
 * ユーザーの請求履歴キャッシュを無効化
 * @param userId ユーザーID
 */
export async function invalidateUserInvoicesCache(
  userId: string
): Promise<boolean> {
  return invalidateCache(
    `${KEY_PREFIX.USER_INVOICES}${userId}`,
    'ユーザー請求履歴キャッシュの無効化に失敗:'
  );
}

/**
 * 組織の請求履歴をキャッシュに保存
 * @param organizationId 組織ID
 * @param data 請求履歴データ
 * @param ttlSeconds 有効期限（秒）、デフォルト5分
 */
export async function setOrgInvoicesCache<T>(
  organizationId: string,
  data: T,
  ttlSeconds: number = 300
): Promise<boolean> {
  return setCache(
    `${KEY_PREFIX.ORG_INVOICES}${organizationId}`,
    data,
    ttlSeconds,
    '組織請求履歴キャッシュの保存に失敗:'
  );
}

/**
 * 組織の請求履歴をキャッシュから取得
 * @param organizationId 組織ID
 */
export async function getOrgInvoicesCache<T>(
  organizationId: string
): Promise<T | null> {
  return getCache<T>(
    `${KEY_PREFIX.ORG_INVOICES}${organizationId}`,
    '組織請求履歴キャッシュの取得に失敗:'
  );
}

/**
 * 組織の請求履歴キャッシュを無効化
 * @param organizationId 組織ID
 */
export async function invalidateOrgInvoicesCache(
  organizationId: string
): Promise<boolean> {
  return invalidateCache(
    `${KEY_PREFIX.ORG_INVOICES}${organizationId}`,
    '組織請求履歴キャッシュの無効化に失敗:'
  );
}

// ============================================
// 管理者監査ログキャッシュ
// ============================================

export async function setAdminAuditLogsCache<T>(
  params: Record<string, unknown>, data: T, ttlSeconds: number = 30
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.ADMIN_AUDIT_LOGS, params),
    data, ttlSeconds, '管理者監査ログキャッシュの保存に失敗'
  );
}

export async function getAdminAuditLogsCache<T>(params: Record<string, unknown>): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.ADMIN_AUDIT_LOGS, params),
    '管理者監査ログキャッシュの取得に失敗'
  );
}

// ============================================
// アクティブユーザーメトリクスキャッシュ（DAU/WAU/MAU）
// ============================================

export async function setAdminMetricsCache<T>(
  params: Record<string, unknown>, data: T, ttlSeconds: number = 300
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.ADMIN_METRICS, params),
    data, ttlSeconds, 'アクティブユーザーメトリクスキャッシュの保存に失敗'
  );
}

export async function getAdminMetricsCache<T>(params: Record<string, unknown>): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.ADMIN_METRICS, params),
    'アクティブユーザーメトリクスキャッシュの取得に失敗'
  );
}

export async function invalidateAdminMetricsCache(): Promise<boolean> {
  return invalidateCacheByPattern(`${KEY_PREFIX.ADMIN_METRICS}*`, 'アクティブユーザーメトリクスキャッシュの無効化に失敗');
}

// ============================================
// システム管理者（AdminUser）一覧キャッシュ
// ============================================

export async function setSystemAdminsCache<T>(
  params: Record<string, unknown>, data: T, ttlSeconds: number = 60
): Promise<boolean> {
  return setCache(
    generateParamsKey(KEY_PREFIX.SYSTEM_ADMINS, params),
    data, ttlSeconds, 'システム管理者一覧キャッシュの保存に失敗'
  );
}

export async function getSystemAdminsCache<T>(params: Record<string, unknown>): Promise<T | null> {
  return getCache<T>(
    generateParamsKey(KEY_PREFIX.SYSTEM_ADMINS, params),
    'システム管理者一覧キャッシュの取得に失敗'
  );
}

export async function invalidateSystemAdminsCache(): Promise<boolean> {
  return invalidateCacheByPattern(`${KEY_PREFIX.SYSTEM_ADMINS}*`, 'システム管理者一覧キャッシュの無効化に失敗');
}

// ============================================
// システム管理者（AdminUser）詳細キャッシュ
// ============================================

export async function getSystemAdminDetailCache<T>(adminUserId: string): Promise<T | null> {
  return getCache<T>(`${KEY_PREFIX.SYSTEM_ADMIN_DETAIL}${adminUserId}`, 'システム管理者詳細キャッシュの取得に失敗');
}

export async function setSystemAdminDetailCache<T>(adminUserId: string, data: T, ttlSeconds: number = 30): Promise<boolean> {
  return setCache(`${KEY_PREFIX.SYSTEM_ADMIN_DETAIL}${adminUserId}`, data, ttlSeconds, 'システム管理者詳細キャッシュの保存に失敗');
}

export async function invalidateSystemAdminDetailCache(adminUserId: string): Promise<boolean> {
  return invalidateCache(`${KEY_PREFIX.SYSTEM_ADMIN_DETAIL}${adminUserId}`, 'システム管理者詳細キャッシュの無効化に失敗');
}
