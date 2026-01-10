import { EditLockService } from '../services/edit-lock.service.js';

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
        console.log(`🔓 ${result.count}件の期限切れロックを解除しました`);

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
              console.error('ロック期限切れ通知エラー:', err);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ ロッククリーンアップエラー:', error);
    }
  };

  // 初回実行
  cleanup();

  // 定期実行
  const intervalId = setInterval(cleanup, intervalMs);

  console.log(`🔄 ロッククリーンアップジョブを開始しました (間隔: ${intervalMs}ms)`);

  return intervalId;
}

/**
 * ジョブを停止
 */
export function stopLockCleanupJob(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('🛑 ロッククリーンアップジョブを停止しました');
}
