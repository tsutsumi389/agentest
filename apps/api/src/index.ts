import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from '@agentest/db';
import { startLockCleanupJob, stopLockCleanupJob } from './jobs/lock-cleanup.job.js';
import { closeRedisPublisher } from './lib/redis-publisher.js';
import { closeEventsPublisher } from './lib/events.js';
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
  // データベース接続確認
  try {
    await prisma.$connect();
    logger.info('データベースに接続しました');
  } catch (error) {
    logger.fatal({ err: error }, 'データベース接続エラー');
    process.exit(1);
  }

  const app = createApp();

  // ロッククリーンアップジョブを開始
  const lockCleanupJobId = startLockCleanupJob();

  // サーバー起動
  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info({ host: env.HOST, port: env.PORT }, 'APIサーバーが起動しました');
    logger.info({ env: env.NODE_ENV }, '環境情報');
  });

  // グレースフルシャットダウン
  const shutdown: ShutdownFn = async (signal, exitCode = 0) => {
    if (isShuttingDown) {
      logger.warn({ signal }, 'シャットダウン処理中のため無視します');
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, 'シャットダウンを開始します');

    // ジョブを停止
    stopLockCleanupJob(lockCleanupJobId);

    server.close(async () => {
      logger.info('HTTPサーバーを終了しました');

      try {
        await closeRedisPublisher();
        logger.info('Redis Publisher接続を終了しました');
      } catch (error) {
        logger.error({ err: error }, 'Redis Publisher切断エラー');
      }

      try {
        await closeEventsPublisher();
        logger.info('Redis Events Publisher接続を終了しました');
      } catch (error) {
        logger.error({ err: error }, 'Redis Events Publisher切断エラー');
      }

      try {
        await prisma.$disconnect();
        logger.info('データベース接続を終了しました');
      } catch (error) {
        logger.error({ err: error }, 'データベース切断エラー');
      }

      process.exit(exitCode);
    });

    // 強制終了タイムアウト
    setTimeout(() => {
      logger.fatal({ exitCode: 1 }, 'タイムアウト: 強制終了します');
      process.exit(1);
    }, 10000).unref();
  };

  // シャットダウン関数を外部からアクセス可能にする
  shutdownFn = shutdown;

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  logger.fatal({ err: error }, 'サーバー起動エラー');
  process.exit(1);
});
