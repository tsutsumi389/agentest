/**
 * Vitest グローバルセットアップ
 * テスト実行前に一度だけ実行される
 * - テスト用DBへスキーマを同期
 */
import { execSync } from 'child_process';

export async function setup() {
  const testDatabaseUrl = 'postgresql://agentest:agentest@db:5432/agentest_test';

  console.log('テスト用DBにスキーマを同期中...');

  try {
    // スキーマを同期（db:pushはマイグレーションファイルが不要）
    execSync('pnpm --filter @agentest/db db:push --skip-generate', {
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
      },
    });
    console.log('スキーマ同期完了');
  } catch (error) {
    console.error('スキーマ同期に失敗しました:', error);
    throw error;
  }
}

export async function teardown() {
  console.log('テスト終了');
}
