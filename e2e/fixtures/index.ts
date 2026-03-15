import { test as base } from '@playwright/test';
import { TestApiClient } from '../helpers/api-client';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';

type Fixtures = {
  apiClient: TestApiClient;
};

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    // Vite HMRのWebSocket接続が常にアクティブなためloadイベントが発火しない場合がある。
    // デフォルトのwaitUntilをdomcontentloadedに変更してタイムアウトを防止する。
    const originalGoto = page.goto.bind(page);
    page.goto = ((
      url: string,
      options?: {
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
        timeout?: number;
        referer?: string;
      }
    ) => {
      return originalGoto(url, { waitUntil: 'domcontentloaded', ...options });
    }) as typeof page.goto;

    // WebアプリがVITE_API_URLで直接APIにアクセスするため、
    // APIリクエストをViteプロキシ経由に書き換えてクッキーが正しく送信されるようにする
    await page.route(`${API_URL}/**`, (route) => {
      const url = route.request().url().replace(API_URL, WEB_URL);
      route.continue({ url });
    });
    await use(page);
  },

  apiClient: async ({ request }, use) => {
    await use(new TestApiClient(request, WEB_URL));
  },
});

export { expect } from '@playwright/test';
