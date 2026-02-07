import { EditLockService } from '../services/edit-lock.service.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'lock-cleanup' });

// WebSocketイベント発火用のコールバック（オプション）
type OnLockExpiredCallback = (lock: {
  id: string;
  targetType: string;
  targetId: string;
}) => Promise<void>;

/**
 * ロッククリーンアップジョブを開始
 * 30秒間隔で期限切れロックを削除する
 */
export function startLockCleanupJob(
  intervalMs = 30000,
  onLockExpired?: OnLockExpiredCallback
): NodeJS.Timeout {
  const editLockService = new EditLockService();

  const cleanup = async () => {
    try {
      const result = await editLockService.processExpiredLocks();

      if (result.count > 0) {
        logger.info({ count: result.count }, '期限切れロックを解除しました');

        // WebSocket通知用コールバック
        if (onLockExpired) {
          for (const lock of result.locks) {
            try {
              await onLockExpired({
                id: lock.id,
                targetType: lock.targetType,
                targetId: lock.targetId,
              });
            } catch (err) {
              logger.error({ err }, 'ロック期限切れ通知エラー');
            }
          }
        }
      }
    } catch (error) {
      logger.error({ err: error }, 'ロッククリーンアップエラー');
    }
  };

  // 初回実行
  cleanup();

  // 定期実行
  const intervalId = setInterval(cleanup, intervalMs);

  logger.info({ intervalMs }, 'ロッククリーンアップジョブを開始しました');

  return intervalId;
}

/**
 * ジョブを停止
 */
export function stopLockCleanupJob(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  logger.info('ロッククリーンアップジョブを停止しました');
}
