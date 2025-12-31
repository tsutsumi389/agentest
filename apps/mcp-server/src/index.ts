import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from '@agentest/db';
import { cleanupAllSessions } from './transport/streamable-http.js';
import { heartbeatService } from './services/heartbeat.service.js';

/**
 * MCPサーバー起動
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

  // ハートビートサービス起動
  heartbeatService.start();

  // サーバー起動
  const server = app.listen(env.PORT, env.HOST, () => {
    console.log(`🚀 MCPサーバーが起動しました: http://${env.HOST}:${env.PORT}`);
    console.log(`📝 環境: ${env.NODE_ENV}`);
    console.log(`🔌 MCPエンドポイント: POST http://${env.HOST}:${env.PORT}/mcp`);
  });

  // グレースフルシャットダウン
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} を受信しました。シャットダウンを開始します...`);

    // ハートビートサービス停止
    heartbeatService.stop();

    // MCPセッションをクリーンアップ
    cleanupAllSessions();
    console.log('MCPセッションをクリーンアップしました');

    server.close(async () => {
      console.log('HTTPサーバーを終了しました');

      try {
        await prisma.$disconnect();
        console.log('データベース接続を終了しました');
      } catch (error) {
        console.error('データベース切断エラー:', error);
      }

      process.exit(0);
    });

    // 強制終了タイムアウト
    setTimeout(() => {
      console.error('タイムアウト: 強制終了します');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('サーバー起動エラー:', error);
  process.exit(1);
});
