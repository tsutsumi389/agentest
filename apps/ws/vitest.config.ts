import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/index.ts',
        'src/__tests__/helpers.ts', // テストヘルパー
        'src/config.ts', // 環境変数読み込み（モジュール初期化時に実行）
        'src/redis.ts', // Redis接続（外部依存）
        'src/server.ts', // WebSocketサーバー（統合テスト向き）
        'vitest.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
