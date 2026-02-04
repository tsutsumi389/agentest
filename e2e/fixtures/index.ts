import { test as base } from '@playwright/test';
import { TestApiClient } from '../helpers/api-client';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';

type Fixtures = {
  apiClient: TestApiClient;
};

export const test = base.extend<Fixtures>({
  // WebアプリがVITE_API_URLで直接APIにアクセスするため、
  // APIリクエストをViteプロキシ経由に書き換えてクッキーが正しく送信されるようにする
  page: async ({ page }, use) => {
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
