import { test as setup, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const authFile = 'e2e/.auth/web-user.json';

setup('Webアプリの認証状態を作成', async ({ request }) => {
  // テスト用ログインエンドポイントで認証
  const response = await request.post(`${API_URL}/api/auth/test-login`, {
    data: { email: 'demo@agentest.dev' },
  });
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body.user).toBeDefined();
  expect(body.user.email).toBe('demo@agentest.dev');

  // 認証状態（クッキー含む）を保存
  await request.storageState({ path: authFile });
});
