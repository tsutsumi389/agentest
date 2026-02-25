import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from '@agentest/db';
import { cleanupAllSessions } from './transport/streamable-http.js';
import { heartbeatService } from './services/heartbeat.service.js';
import { closeRedis } from './lib/redis.js';
import { registerServerInstance } from './lib/server-instance.js';
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
 * MCPサーバー起動
 */
async function main() {
  // データベース接続確認
  try {
    await prisma.$connect();
    logger.info('データベースに接続しました');
  } catch (error) {
    logger.error({ err: error }, 'データベース接続エラー');
    process.exit(1);
  }

  // サーバーインスタンスをRedisに登録
  await registerServerInstance();

  const app = createApp();

  // ハートビートサービス起動
  heartbeatService.start();

  // サーバー起動
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'MCPサーバーが起動しました');
    logger.info({ nodeEnv: env.NODE_ENV }, '環境');
    logger.info({ endpoint: `http://${env.HOST}:${env.PORT}/mcp` }, 'MCPエンドポイント');
  });

  // グレースフルシャットダウン
  const shutdown: ShutdownFn = async (signal, exitCode = 0) => {
    if (isShuttingDown) {
      logger.info({ signal }, 'シャットダウン処理中のためシグナルを無視します');
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, 'シグナルを受信しました。シャットダウンを開始します');

    // ハートビートサービス停止
    heartbeatService.stop();

    // MCPセッションをクリーンアップ（Redis削除を待つ）
    await cleanupAllSessions();
    logger.info('MCPセッションをクリーンアップしました');

    server.close(async () => {
      logger.info('HTTPサーバーを終了しました');

      try {
        await closeRedis();
        await prisma.$disconnect();
        logger.info('データベース接続を終了しました');
      } catch (error) {
        logger.error({ err: error }, 'リソース切断エラー');
      }

      process.exit(exitCode);
    });

    // 強制終了タイムアウト
    setTimeout(() => {
      logger.error('タイムアウト: 強制終了します');
      process.exit(1);
    }, 10000).unref();
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
