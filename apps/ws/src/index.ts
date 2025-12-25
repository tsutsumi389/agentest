import { createWebSocketServer, closeServer } from './server.js';
import { closeRedis } from './redis.js';
import { env } from './config.js';

/**
 * サーバー起動
 */
async function main() {
  // WebSocketサーバーを起動
  createWebSocketServer(env.PORT, env.HOST);

  console.log(`📝 環境: ${env.NODE_ENV}`);

  // グレースフルシャットダウン
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} を受信しました。シャットダウンを開始します...`);

    try {
      await closeServer();
      await closeRedis();
      console.log('シャットダウン完了');
    } catch (error) {
      console.error('シャットダウンエラー:', error);
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('サーバー起動エラー:', error);
  process.exit(1);
});
