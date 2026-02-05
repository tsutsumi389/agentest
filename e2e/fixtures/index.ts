import { test as base } from '@playwright/test';
import { TestApiClient } from '../helpers/api-client';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';

// E2Eテスト用のヘッダー（レートリミットをバイパス）
const E2E_HEADERS = {
  'X-E2E-Test': 'true',
};

type Fixtures = {
  apiClient: TestApiClient;
};

export const test = base.extend<Fixtures>({
  // WebアプリがVITE_API_URLで直接APIにアクセスするため、
  // APIリクエストをViteプロキシ経由に書き換えてクッキーが正しく送信されるようにする
  // また、E2Eテストヘッダーを追加してレートリミットをバイパス
  page: async ({ page }, use) => {
    await page.route(`${API_URL}/**`, (route) => {
      const url = route.request().url().replace(API_URL, WEB_URL);
      const headers = {
        ...route.request().headers(),
        ...E2E_HEADERS,
      };
      route.continue({ url, headers });
    });
    // Webアプリからの直接APIリクエスト（Viteプロキシ経由）にもE2Eヘッダーを追加
    await page.route(`${WEB_URL}/api/**`, (route) => {
      const headers = {
        ...route.request().headers(),
        ...E2E_HEADERS,
      };
      route.continue({ headers });
    });
    await use(page);
  },

  apiClient: async ({ request }, use) => {
    await use(new TestApiClient(request, WEB_URL));
  },
});

export { expect } from '@playwright/test';
