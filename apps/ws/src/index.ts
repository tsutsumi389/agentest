import { createWebSocketServer, closeServer } from './server.js';
import { closeRedis } from './redis.js';
import { env } from './config.js';
import { registerProcessHandlers, type ShutdownFn } from '@agentest/shared';
import { logger } from './utils/logger.js';

// シャットダウン重複実行防止フラグ
let isShuttingDown = false;

// main内で定義されるシャットダウン関数への参照
let shutdownFn: ShutdownFn | null = null;

// プロセスレベルの例外ハンドラ（起動中のエラーもキャッチするためモジュールレベルで登録）
registerProcessHandlers({
  getShutdownFn: () => shutdownFn,
  logger,
});

/**
 * サーバー起動
 */
async function main() {
  // WebSocketサーバーを起動
  createWebSocketServer(env.PORT, env.HOST);

  logger.info({ nodeEnv: env.NODE_ENV }, '環境');

  // グレースフルシャットダウン
  const shutdown: ShutdownFn = async (signal, exitCode = 0) => {
    if (isShuttingDown) {
      logger.info({ signal }, 'シャットダウン処理中のため信号を無視します');
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, 'シグナルを受信しました。シャットダウンを開始します');

    // 強制終了タイムアウト
    setTimeout(() => {
      logger.error('タイムアウト: 強制終了します');
      process.exit(1);
    }, 10000).unref();

    try {
      await closeServer();
      await closeRedis();
      logger.info('シャットダウン完了');
    } catch (error) {
      logger.error({ err: error }, 'シャットダウンエラー');
    }

    process.exit(exitCode);
  };

  // シャットダウン関数を外部からアクセス可能にする
  shutdownFn = shutdown;

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.error({ err: error }, 'サーバー起動エラー');
  process.exit(1);
});
