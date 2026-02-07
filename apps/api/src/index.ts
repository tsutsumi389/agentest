import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from '@agentest/db';
import { startLockCleanupJob, stopLockCleanupJob } from './jobs/lock-cleanup.job.js';
import { closeRedisPublisher } from './lib/redis-publisher.js';
import { closeEventsPublisher } from './lib/events.js';

// シャットダウン重複実行防止フラグ
let isShuttingDown = false;

// main内で定義されるシャットダウン関数への参照
let shutdownFn: ((signal: string, exitCode?: number) => Promise<void>) | null = null;

// プロセスレベルの例外ハンドラ（起動中のエラーもキャッチするためモジュールレベルで登録）
process.on('uncaughtException', (error) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: 'キャッチされない例外が発生しました',
    error: error.message,
    stack: error.stack,
  }));
  if (shutdownFn) {
    shutdownFn('uncaughtException', 1).catch(() => {});
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'error',
    message: '未処理のPromise拒否が発生しました',
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  }));
  if (shutdownFn) {
    shutdownFn('unhandledRejection', 1).catch(() => {});
  } else {
    process.exit(1);
  }
});

/**
 * サーバー起動
 */
async function main() {
  // データベース接続確認
  try {
    await prisma.$connect();
    console.log('✅ データベースに接続しました');
  } catch (error) {
    console.error('❌ データベース接続エラー:', error);
    process.exit(1);
  }

  const app = createApp();

  // ロッククリーンアップジョブを開始
  const lockCleanupJobId = startLockCleanupJob();

  // サーバー起動
  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`🚀 APIサーバーが起動しました: http://${env.HOST}:${env.PORT}`);
    console.log(`📝 環境: ${env.NODE_ENV}`);
  });

  // グレースフルシャットダウン
  const shutdown = async (signal: string, exitCode: number = 0) => {
    if (isShuttingDown) {
      console.log(`シャットダウン処理中のため ${signal} を無視します`);
      return;
    }
    isShuttingDown = true;

    console.log(`\n${signal} を受信しました。シャットダウンを開始します...`);

    // ジョブを停止
    stopLockCleanupJob(lockCleanupJobId);

    server.close(async () => {
      console.log('HTTPサーバーを終了しました');

      try {
        await closeRedisPublisher();
        console.log('Redis Publisher接続を終了しました');
      } catch (error) {
        console.error('Redis Publisher切断エラー:', error);
      }

      try {
        await closeEventsPublisher();
        console.log('Redis Events Publisher接続を終了しました');
      } catch (error) {
        console.error('Redis Events Publisher切断エラー:', error);
      }

      try {
        await prisma.$disconnect();
        console.log('データベース接続を終了しました');
      } catch (error) {
        console.error('データベース切断エラー:', error);
      }

      process.exit(exitCode);
    });

    // 強制終了タイムアウト
    setTimeout(() => {
      console.error('タイムアウト: 強制終了します');
      process.exit(1);
    }, 10000).unref();
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
