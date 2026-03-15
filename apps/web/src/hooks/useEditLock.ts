import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  LockTargetType,
  LockAcquiredEvent,
  LockReleasedEvent,
  LockExpiredEvent,
} from '@agentest/ws-types';
import type { LockHolder } from '@agentest/shared';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';
import { useAuth } from './useAuth';

/**
 * ロック設定（サーバーと同期）
 */
const LOCK_CONFIG = {
  HEARTBEAT_INTERVAL_MS: 30000, // 30秒
};

/**
 * ロック情報
 */
interface LockInfo {
  id: string;
  targetType: LockTargetType;
  targetId: string;
  lockedBy: LockHolder;
  expiresAt: string;
}

/**
 * ロック取得レスポンス
 */
interface AcquireLockResponse {
  lock: LockInfo;
  config: {
    heartbeatIntervalSeconds: number;
  };
}

/**
 * ロック状態レスポンス
 */
interface LockStatusResponse {
  isLocked: boolean;
  lock: LockInfo | null;
}

/**
 * useEditLockの戻り値
 */
interface UseEditLockResult {
  isLocked: boolean;
  isOwnLock: boolean;
  lockHolder: LockHolder | null;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  error: string | null;
  isLoading: boolean;
}

/**
 * useEditLockオプション
 */
interface UseEditLockOptions {
  targetType: LockTargetType;
  targetId: string;
  autoAcquire?: boolean;
}

/**
 * 編集ロックフック
 */
export function useEditLock(options: UseEditLockOptions): UseEditLockResult {
  const { targetType, targetId, autoAcquire = false } = options;
  const { user } = useAuth();

  const [isLocked, setIsLocked] = useState(false);
  const [isOwnLock, setIsOwnLock] = useState(false);
  const [lockHolder, setLockHolder] = useState<LockHolder | null>(null);
  const [lockId, setLockId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * ロック状態を更新
   */
  const updateLockState = useCallback(
    (lockInfo: LockInfo | null) => {
      if (lockInfo) {
        setIsLocked(true);
        setLockHolder(lockInfo.lockedBy);
        setIsOwnLock(lockInfo.lockedBy.id === user?.id);
        setLockId(lockInfo.id);
      } else {
        setIsLocked(false);
        setLockHolder(null);
        setIsOwnLock(false);
        setLockId(null);
      }
    },
    [user?.id]
  );

  /**
   * ロック状態を取得
   */
  const fetchLockStatus = useCallback(async () => {
    try {
      const response = await api.get<LockStatusResponse>(
        `/locks?targetType=${targetType}&targetId=${targetId}`
      );
      updateLockState(response.lock);
    } catch (err) {
      console.error('ロック状態取得エラー:', err);
    }
  }, [targetType, targetId, updateLockState]);

  /**
   * ハートビートを開始
   */
  const startHeartbeat = useCallback(
    (currentLockId: string) => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          await api.patch<{ lock: LockInfo }>(`/locks/${currentLockId}/heartbeat`);
        } catch (err) {
          console.error('ハートビート更新エラー:', err);
          // ロックが失われた可能性があるので状態を更新
          fetchLockStatus();
        }
      }, LOCK_CONFIG.HEARTBEAT_INTERVAL_MS);
    },
    [fetchLockStatus]
  );

  /**
   * ハートビートを停止
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * ロックを取得
   */
  const acquireLock = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<AcquireLockResponse>('/locks', {
        targetType,
        targetId,
      });

      updateLockState(response.lock);
      startHeartbeat(response.lock.id);
      return true;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'statusCode' in err &&
        (err as { statusCode: number }).statusCode === 409
      ) {
        // ロック競合
        const lockError = err as { lockedBy?: LockHolder };
        setError(`${lockError.lockedBy?.name ?? '他のユーザー'}が編集中です`);
        fetchLockStatus();
      } else {
        setError('ロック取得に失敗しました');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [targetType, targetId, updateLockState, startHeartbeat, fetchLockStatus]);

  /**
   * ロックを解放
   */
  const releaseLock = useCallback(async (): Promise<void> => {
    if (!lockId) return;

    stopHeartbeat();

    try {
      await api.delete(`/locks/${lockId}`);
      updateLockState(null);
    } catch (err) {
      console.error('ロック解放エラー:', err);
    }
  }, [lockId, stopHeartbeat, updateLockState]);

  /**
   * WebSocketイベント購読
   */
  useEffect(() => {
    // ロックイベントを購読
    const unsubscribeAcquired = wsClient.on<LockAcquiredEvent>('lock:acquired', (event) => {
      if (event.targetType === targetType && event.targetId === targetId) {
        updateLockState({
          id: event.lockId,
          targetType: event.targetType,
          targetId: event.targetId,
          lockedBy: event.lockedBy,
          expiresAt: event.expiresAt,
        });
      }
    });

    const unsubscribeReleased = wsClient.on<LockReleasedEvent>('lock:released', (event) => {
      if (event.targetType === targetType && event.targetId === targetId) {
        updateLockState(null);
      }
    });

    const unsubscribeExpired = wsClient.on<LockExpiredEvent>('lock:expired', (event) => {
      if (event.targetType === targetType && event.targetId === targetId) {
        updateLockState(null);
      }
    });

    return () => {
      unsubscribeAcquired();
      unsubscribeReleased();
      unsubscribeExpired();
    };
  }, [targetType, targetId, updateLockState]);

  /**
   * 初期ロード
   */
  useEffect(() => {
    fetchLockStatus();

    if (autoAcquire) {
      acquireLock();
    }

    return () => {
      stopHeartbeat();
    };
  }, [fetchLockStatus, autoAcquire, acquireLock, stopHeartbeat]);

  /**
   * アンマウント時のクリーンアップ
   */
  useEffect(() => {
    return () => {
      if (isOwnLock && lockId) {
        // アンマウント時にロック解放を試みる（ベストエフォート）
        api.delete(`/locks/${lockId}`).catch(() => {
          // エラーは無視（ページ遷移時など）
        });
      }
    };
  }, [isOwnLock, lockId]);

  return {
    isLocked,
    isOwnLock,
    lockHolder,
    acquireLock,
    releaseLock,
    error,
    isLoading,
  };
}
