import { Redis } from 'ioredis';
import { env } from '../../config/env.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ module: 'redis-store' });

/**
 * SCANコマンドでパターンにマッチするキーを収集する
 * KEYSコマンドと違い、O(N)で全体をブロックしない
 */
export async function scanKeys(redis: Redis, pattern: string): Promise<string[]> {
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
export const KEY_PREFIX = {
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
export function requireRedisInProduction(): void {
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
    redisClient = new Redis(env.REDIS_URL, {
      ...(env.REDIS_URL.startsWith('rediss://') && { tls: { rejectUnauthorized: false } }),
    });

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
 * Redis接続をクリーンアップ
 */
export async function closeRedisStore(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
