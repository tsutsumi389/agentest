/**
 * Vitest セットアップファイル
 * 各テストファイル実行前に実行される
 * - テスト用DBへの接続を確認
 */
import { beforeAll, afterAll } from 'vitest';
import { prisma } from '@agentest/db';

beforeAll(async () => {
  // 環境変数が正しく設定されているか確認
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl?.includes('agentest_test')) {
    throw new Error(
      `テスト用DBに接続していません。DATABASE_URL: ${dbUrl}\n` +
        'テスト実行時は agentest_test データベースに接続する必要があります。'
    );
  }

  // Prismaクライアントの接続確認
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
