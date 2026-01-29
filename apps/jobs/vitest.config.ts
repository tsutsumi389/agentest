import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // 結合テストはデータベースを共有するためシリアル実行
    fileParallelism: false,
    // モック競合を防ぐため、各テストファイルを分離して実行
    isolate: true,
    // テスト用DB接続設定
    globalSetup: ['./src/__tests__/setup/globalSetup.ts'],
    setupFiles: ['./src/__tests__/setup/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://agentest:agentest@db:5432/agentest_test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts'],
    },
  },
});
