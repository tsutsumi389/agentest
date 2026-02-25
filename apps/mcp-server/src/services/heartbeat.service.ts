import { agentSessionService, SESSION_CONFIG } from './agent-session.service.js';
import { refreshInstanceHeartbeat } from '../lib/server-instance.js';
import { getActiveSessionCount } from '../transport/streamable-http.js';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ module: 'heartbeat' });

/**
 * ハートビートサービス
 * 定期的にセッションのタイムアウトをチェックする
 */
class HeartbeatService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * ハートビート監視を開始
   * @param intervalMs チェック間隔（ミリ秒）。デフォルトはハートビート間隔
   */
  start(intervalMs: number = SESSION_CONFIG.HEARTBEAT_INTERVAL * 1000): void {
    if (this.isRunning) {
      logger.warn('ハートビートサービスは既に起動しています');
      return;
    }

    this.isRunning = true;
    logger.info({ intervalSec: intervalMs / 1000 }, 'ハートビートサービスを開始しました');

    // 初回実行
    this.checkTimeouts().catch((error) => {
      logger.error({ err: error }, 'ハートビートチェックエラー');
    });

    // 定期実行
    this.intervalId = setInterval(() => {
      this.checkTimeouts().catch((error) => {
        logger.error({ err: error }, 'ハートビートチェックエラー');
      });
    }, intervalMs);
  }

  /**
   * ハートビート監視を停止
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    logger.info('ハートビートサービスを停止しました');
  }

  /**
   * タイムアウトチェックを実行
   */
  private async checkTimeouts(): Promise<void> {
    // ログ出力はagentSessionService.processTimedOutSessions()内で行われる
    await agentSessionService.processTimedOutSessions();

    // 自インスタンスの生存をRedisに表明
    await refreshInstanceHeartbeat();

    // インメモリセッション数を記録（運用監視用）
    logger.debug(
      { activeSessions: getActiveSessionCount() },
      'インメモリセッション状態',
    );
  }

  /**
   * サービスが起動中かどうか
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// シングルトンインスタンス
export const heartbeatService = new HeartbeatService();
