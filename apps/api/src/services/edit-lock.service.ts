import type { LockTargetType } from '@agentest/db';
import { LockConflictError, NotFoundError, AuthorizationError } from '@agentest/shared';
import { EditLockRepository, type EditLockWithOwner } from '../repositories/edit-lock.repository.js';

/**
 * ロック設定
 */
export const LOCK_CONFIG = {
  /** ロック有効期限（秒） */
  LOCK_DURATION_SECONDS: 90,
  /** ハートビート推奨間隔（秒） */
  HEARTBEAT_INTERVAL_SECONDS: 30,
  /** ハートビート途絶タイムアウト（秒） */
  HEARTBEAT_TIMEOUT_SECONDS: 60,
};

/**
 * アクター情報
 */
export interface ActorInfo {
  type: 'user';
  id: string;
  name: string;
}

/**
 * ロック情報のレスポンス型
 */
export interface LockInfo {
  id: string;
  targetType: LockTargetType;
  targetId: string;
  lockedBy: {
    type: 'user';
    id: string;
    name: string;
  };
  expiresAt: Date;
}

/**
 * ロック状態のレスポンス型
 */
export interface LockStatus {
  isLocked: boolean;
  lock: LockInfo | null;
}

/**
 * 編集ロックサービス
 */
export class EditLockService {
  private lockRepo = new EditLockRepository();

  /**
   * ロックを取得
   * 既にロックされている場合はLockConflictErrorをスロー
   */
  async acquireLock(
    targetType: LockTargetType,
    targetId: string,
    actor: ActorInfo
  ): Promise<LockInfo> {
    // 既存ロックを確認
    const existingLock = await this.lockRepo.findByTarget(targetType, targetId);

    if (existingLock) {
      // 期限切れチェック
      if (existingLock.expiresAt > new Date()) {
        // 自分のロックの場合はハートビート更新として扱う
        if (existingLock.lockedByUserId === actor.id) {
          return this.updateHeartbeat(existingLock.id, actor);
        }

        // 他者がロック中 → 競合エラー
        throw new LockConflictError(
          {
            type: 'user',
            id: existingLock.lockedByUserId!,
            name: existingLock.lockedBy?.name ?? 'Unknown',
          },
          existingLock.expiresAt
        );
      }

      // 期限切れなので削除
      await this.lockRepo.delete(existingLock.id);
    }

    // 新規ロックを作成
    const expiresAt = new Date(Date.now() + LOCK_CONFIG.LOCK_DURATION_SECONDS * 1000);
    const lock = await this.lockRepo.create({
      targetType,
      targetId,
      lockedByUserId: actor.id,
      expiresAt,
    });

    return this.toLockInfo(lock);
  }

  /**
   * ロック状態を確認（取得せずに確認のみ）
   */
  async getLockStatus(targetType: LockTargetType, targetId: string): Promise<LockStatus> {
    const lock = await this.lockRepo.findByTarget(targetType, targetId);

    if (!lock || lock.expiresAt <= new Date()) {
      return { isLocked: false, lock: null };
    }

    return {
      isLocked: true,
      lock: this.toLockInfo(lock),
    };
  }

  /**
   * ハートビートを更新
   */
  async updateHeartbeat(lockId: string, actor: ActorInfo): Promise<LockInfo> {
    const lock = await this.lockRepo.findById(lockId);

    if (!lock) {
      throw new NotFoundError('EditLock', lockId);
    }

    // 所有者チェック
    if (lock.lockedByUserId !== actor.id) {
      throw new AuthorizationError('Not the lock owner');
    }

    // 有効期限を延長
    const expiresAt = new Date(Date.now() + LOCK_CONFIG.LOCK_DURATION_SECONDS * 1000);
    const updatedLock = await this.lockRepo.updateHeartbeat(lockId, expiresAt);

    return this.toLockInfo(updatedLock);
  }

  /**
   * ロックを解放
   */
  async releaseLock(lockId: string, actor: ActorInfo): Promise<void> {
    const lock = await this.lockRepo.findById(lockId);

    if (!lock) {
      // 既に解放されているか存在しない
      return;
    }

    // 所有者チェック
    if (lock.lockedByUserId !== actor.id) {
      throw new AuthorizationError('Not the lock owner');
    }

    await this.lockRepo.delete(lockId);
  }

  /**
   * 強制ロック解除（管理者用）
   */
  async forceRelease(lockId: string): Promise<EditLockWithOwner | null> {
    const lock = await this.lockRepo.findById(lockId);

    if (!lock) {
      return null;
    }

    await this.lockRepo.delete(lockId);
    return lock;
  }

  /**
   * 期限切れロックを処理
   */
  async processExpiredLocks(): Promise<{ count: number; locks: EditLockWithOwner[] }> {
    // 期限切れロックを取得（WebSocket通知用）
    const expiredLocks = await this.lockRepo.findExpired();

    // 一括削除
    const count = await this.lockRepo.deleteExpired();

    return { count, locks: expiredLocks };
  }

  /**
   * EditLockエンティティをLockInfoに変換
   */
  private toLockInfo(lock: EditLockWithOwner): LockInfo {
    return {
      id: lock.id,
      targetType: lock.targetType,
      targetId: lock.targetId,
      lockedBy: {
        type: 'user',
        id: lock.lockedByUserId!,
        name: lock.lockedBy?.name ?? 'Unknown',
      },
      expiresAt: lock.expiresAt,
    };
  }
}
