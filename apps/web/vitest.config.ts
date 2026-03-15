import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.ts', 'src/hooks/**/*.ts', 'src/stores/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.tsx',
        '**/*.test.ts',
        '**/index.ts',
        'src/__tests__/**',
        'vitest.config.ts',
        // インフラ層（APIクライアント、WebSocket）は統合テストで対応
        'src/lib/api.ts',
        'src/lib/ws.ts',
        // WebSocket/API依存が強いフックは統合テストで対応
        'src/hooks/useEditLock.ts',
        'src/hooks/useNotifications.ts',
        'src/hooks/usePictureInPicture.ts',
        'src/hooks/useProjectDashboard.ts',
        'src/hooks/useTestCaseRealtime.ts',
        'src/hooks/useTestSuiteRealtime.ts',
        'src/hooks/useCurrentProject.ts',
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
