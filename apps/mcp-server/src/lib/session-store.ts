import { getRedisClient } from './redis.js';
import { getServerInstanceId, getMachineId } from './server-instance.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'session-store' });

const KEY_PREFIX = 'mcp:session:';
const SESSION_TTL_SECONDS = 180; // ハートビートタイムアウト(60s)の3倍

/**
 * Redisに保存するセッションメタデータ
 */
export interface StoredSessionData {
  userId: string;
  instanceId: string;
  machineId: string;
  createdAt: string;
}

/**
 * セッションメタデータをRedisに保存
 */
export async function saveSession(
  sessionId: string,
  data: { userId: string },
): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const stored: StoredSessionData = {
      userId: data.userId,
      instanceId: getServerInstanceId(),
      machineId: getMachineId(),
      createdAt: new Date().toISOString(),
    };
    await redis.setex(
      `${KEY_PREFIX}${sessionId}`,
      SESSION_TTL_SECONDS,
      JSON.stringify(stored),
    );
  } catch (error) {
    logger.error({ err: error }, 'セッションメタデータの保存に失敗');
  }
}

/**
 * セッションメタデータを取得
 */
export async function getSession(sessionId: string): Promise<StoredSessionData | null> {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const data = await redis.get(`${KEY_PREFIX}${sessionId}`);
    if (!data) return null;
    const parsed = JSON.parse(data);
    // Redisデータ破損に備えた最低限のフィールド存在チェック
    if (
      typeof parsed?.userId !== 'string' ||
      typeof parsed?.instanceId !== 'string' ||
      typeof parsed?.machineId !== 'string'
    ) {
      logger.warn({ sessionId }, 'セッションデータのフォーマットが不正です');
      return null;
    }
    return parsed as StoredSessionData;
  } catch (error) {
    logger.error({ err: error }, 'セッションメタデータの取得に失敗');
    return null;
  }
}

/**
 * セッションメタデータをRedisから削除
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.del(`${KEY_PREFIX}${sessionId}`);
  } catch (error) {
    logger.error({ err: error }, 'セッションメタデータの削除に失敗');
  }
}

/**
 * セッションのTTLを延長（リクエスト毎に呼び出し）
 */
export async function refreshSessionTtl(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.expire(`${KEY_PREFIX}${sessionId}`, SESSION_TTL_SECONDS);
  } catch (error) {
    logger.error({ err: error }, 'セッションTTLの延長に失敗');
  }
}
