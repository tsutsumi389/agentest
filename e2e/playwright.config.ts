import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ja-JP',
  },
  projects: [
    // 認証セットアッププロジェクト
    {
      name: 'web-setup',
      testDir: './auth',
      testMatch: 'web.setup.ts',
    },
    // Webアプリテスト（認証済み）
    {
      name: 'web',
      testDir: './tests/web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_WEB_URL || 'http://localhost:3000',
        storageState: 'e2e/.auth/web-user.json',
      },
      dependencies: ['web-setup'],
    },
  ],
});
