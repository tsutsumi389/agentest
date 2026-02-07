import { createWebSocketServer, closeServer } from './server.js';
import { closeRedis } from './redis.js';
import { env } from './config.js';
import { registerProcessHandlers, type ShutdownFn } from '@agentest/shared';

// シャットダウン重複実行防止フラグ
let isShuttingDown = false;

// main内で定義されるシャットダウン関数への参照
let shutdownFn: ShutdownFn | null = null;

// プロセスレベルの例外ハンドラ（起動中のエラーもキャッチするためモジュールレベルで登録）
registerProcessHandlers({
  getShutdownFn: () => shutdownFn,
});

/**
 * サーバー起動
 */
async function main() {
  // WebSocketサーバーを起動
  createWebSocketServer(env.PORT, env.HOST);

  console.log(`📝 環境: ${env.NODE_ENV}`);

  // グレースフルシャットダウン
  const shutdown: ShutdownFn = async (signal, exitCode = 0) => {
    if (isShuttingDown) {
      console.log(`シャットダウン処理中のため ${signal} を無視します`);
      return;
    }
    isShuttingDown = true;

    console.log(`\n${signal} を受信しました。シャットダウンを開始します...`);

    // 強制終了タイムアウト
    setTimeout(() => {
      console.error('タイムアウト: 強制終了します');
      process.exit(1);
    }, 10000).unref();

    try {
      await closeServer();
      await closeRedis();
      console.log('シャットダウン完了');
    } catch (error) {
      console.error('シャットダウンエラー:', error);
    }

    process.exit(exitCode);
  };

  // シャットダウン関数を外部からアクセス可能にする
  shutdownFn = shutdown;

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('サーバー起動エラー:', error);
  process.exit(1);
});
