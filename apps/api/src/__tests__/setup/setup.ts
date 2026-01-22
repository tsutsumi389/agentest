/**
 * Vitest セットアップファイル
 * 各テストファイル実行前に実行される
 * - bcryptをbcryptjsでモック（Docker環境でのネイティブモジュール問題を回避）
 * - テスト用DBへの接続を確認
 */
import { vi, beforeAll, afterAll } from 'vitest';
import bcryptjs from 'bcryptjs';

// bcryptをbcryptjsでモック（Docker環境ではbcryptのネイティブモジュールがビルドされないため）
vi.mock('bcrypt', () => ({
  default: {
    hash: (password: string, rounds: number) => bcryptjs.hash(password, rounds),
    compare: (password: string, hash: string) => bcryptjs.compare(password, hash),
    hashSync: (password: string, rounds: number) => bcryptjs.hashSync(password, rounds),
    compareSync: (password: string, hash: string) => bcryptjs.compareSync(password, hash),
    genSalt: (rounds: number) => bcryptjs.genSalt(rounds),
    genSaltSync: (rounds: number) => bcryptjs.genSaltSync(rounds),
  },
}));
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
