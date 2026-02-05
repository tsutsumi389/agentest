import { test as setup, expect } from '@playwright/test';

const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';
const authFile = '.auth/web-user.json';

setup('Webアプリの認証状態を作成', async ({ page }) => {
  // E2Eテストヘッダーを追加するルーティング
  await page.route(`${WEB_URL}/api/**`, (route) => {
    const headers = {
      ...route.request().headers(),
      'X-E2E-Test': 'true',
    };
    route.continue({ headers });
  });

  // ブラウザでページを開く
  await page.goto(`${WEB_URL}/login`);

  // Viteプロキシ経由でテストログインAPIを呼び出し、クッキーをブラウザに保存させる
  // E2Eヘッダーを追加してレートリミットをバイパス
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/auth/test-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-E2E-Test': 'true',
      },
      body: JSON.stringify({ email: 'demo@agentest.dev' }),
      credentials: 'include',
    });
    const body = await res.json();
    return { ok: res.ok, status: res.status, body };
  });

  expect(result.ok).toBeTruthy();
  expect(result.body.user).toBeDefined();
  expect(result.body.user.email).toBe('demo@agentest.dev');

  // ブラウザコンテキストの認証状態を保存
  await page.context().storageState({ path: authFile });
});
