import { agentSessionService, SESSION_CONFIG } from './agent-session.service.js';

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
      console.warn('ハートビートサービスは既に起動しています');
      return;
    }

    this.isRunning = true;
    console.log(
      `ハートビートサービスを開始しました（間隔: ${intervalMs / 1000}秒）`
    );

    // 初回実行
    this.checkTimeouts().catch((error) => {
      console.error('ハートビートチェックエラー:', error);
    });

    // 定期実行
    this.intervalId = setInterval(() => {
      this.checkTimeouts().catch((error) => {
        console.error('ハートビートチェックエラー:', error);
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
    console.log('ハートビートサービスを停止しました');
  }

  /**
   * タイムアウトチェックを実行
   */
  private async checkTimeouts(): Promise<void> {
    // ログ出力はagentSessionService.processTimedOutSessions()内で行われる
    await agentSessionService.processTimedOutSessions();
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
