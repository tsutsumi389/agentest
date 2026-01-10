import type {
  LockAcquiredEvent,
  LockReleasedEvent,
  LockExpiredEvent,
  LockTargetType,
} from '@agentest/ws-types';
import { Channels } from '@agentest/ws-types';
import { publishEvent } from '../redis.js';

/**
 * ロック取得イベントをパブリッシュ
 */
export async function publishLockAcquired(
  lockId: string,
  targetType: LockTargetType,
  targetId: string,
  projectId: string,
  lockedBy: { type: 'user' | 'agent'; id: string; name: string },
  expiresAt: Date
): Promise<void> {
  const event: LockAcquiredEvent = {
    type: 'lock:acquired',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    lockId,
    targetType,
    targetId,
    lockedBy,
    expiresAt: expiresAt.toISOString(),
  };

  // プロジェクトチャンネルとターゲットチャンネルにパブリッシュ
  const targetChannel =
    targetType === 'SUITE' ? Channels.testSuite(targetId) : Channels.testCase(targetId);

  await Promise.allSettled([
    publishEvent(Channels.project(projectId), event),
    publishEvent(targetChannel, event),
  ]);
}

/**
 * ロック解放イベントをパブリッシュ
 */
export async function publishLockReleased(
  lockId: string,
  targetType: LockTargetType,
  targetId: string,
  projectId: string
): Promise<void> {
  const event: LockReleasedEvent = {
    type: 'lock:released',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    lockId,
    targetType,
    targetId,
  };

  // プロジェクトチャンネルとターゲットチャンネルにパブリッシュ
  const targetChannel =
    targetType === 'SUITE' ? Channels.testSuite(targetId) : Channels.testCase(targetId);

  await Promise.allSettled([
    publishEvent(Channels.project(projectId), event),
    publishEvent(targetChannel, event),
  ]);
}

/**
 * ロック期限切れイベントをパブリッシュ
 */
export async function publishLockExpired(
  lockId: string,
  targetType: LockTargetType,
  targetId: string,
  projectId: string
): Promise<void> {
  const event: LockExpiredEvent = {
    type: 'lock:expired',
    eventId: crypto.randomUUID(),
    timestamp: Date.now(),
    lockId,
    targetType,
    targetId,
  };

  // プロジェクトチャンネルとターゲットチャンネルにパブリッシュ
  const targetChannel =
    targetType === 'SUITE' ? Channels.testSuite(targetId) : Channels.testCase(targetId);

  await Promise.allSettled([
    publishEvent(Channels.project(projectId), event),
    publishEvent(targetChannel, event),
  ]);
}
