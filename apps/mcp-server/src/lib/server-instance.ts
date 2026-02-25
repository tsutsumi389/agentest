import { randomUUID } from 'crypto';
import os from 'os';
import { getRedisClient } from './redis.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'server-instance' });

// プロセス起動ごとに一意のインスタンスID
const SERVER_INSTANCE_ID = randomUUID();

// マシンID: コンテナ/マシン単位で一意。プロセス再起動しても変わらない。
// Cloud Runでは各コンテナインスタンスが異なるホスト名を持つ。
const MACHINE_ID = process.env.HOSTNAME || os.hostname();

const SERVER_STARTED_AT = new Date().toISOString();
const REDIS_KEY_PREFIX = 'mcp:instance:';
const INSTANCE_TTL_SECONDS = 120; // 2分（ハートビート間隔30秒の4倍）

export function getServerInstanceId(): string {
  return SERVER_INSTANCE_ID;
}

export function getMachineId(): string {
  return MACHINE_ID;
}

/**
 * インスタンスをRedisに登録
 * 定期的にTTLを延長することで生存を表明する
 */
export async function registerServerInstance(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.setex(
      `${REDIS_KEY_PREFIX}${SERVER_INSTANCE_ID}`,
      INSTANCE_TTL_SECONDS,
      JSON.stringify({ machineId: MACHINE_ID, startedAt: SERVER_STARTED_AT })
    );
    logger.info({ instanceId: SERVER_INSTANCE_ID, machineId: MACHINE_ID }, 'サーバーインスタンスをRedisに登録しました');
  } catch (error) {
    logger.error({ err: error }, 'サーバーインスタンスの登録に失敗');
  }
}

/**
 * インスタンスのTTLを延長（ハートビートで呼び出し）
 */
export async function refreshInstanceHeartbeat(): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.expire(`${REDIS_KEY_PREFIX}${SERVER_INSTANCE_ID}`, INSTANCE_TTL_SECONDS);
  } catch (error) {
    logger.error({ err: error }, 'インスタンスハートビートの更新に失敗');
  }
}

/**
 * 指定インスタンスが生存しているか確認
 */
export async function isInstanceAlive(instanceId: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  try {
    const exists = await redis.exists(`${REDIS_KEY_PREFIX}${instanceId}`);
    return exists === 1;
  } catch (error) {
    logger.error({ err: error }, 'インスタンス生存確認に失敗');
    return false;
  }
}
