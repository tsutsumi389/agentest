import { test, expect } from '@playwright/test';

// ログインページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('ログインページ', () => {
  test('未認証ユーザーにログインページが表示される', async ({ page }) => {
    await page.goto('/login');

    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();

    // GitHubログインボタンの存在確認
    await expect(page.getByRole('button', { name: /GitHub/i })).toBeVisible();

    // Googleログインボタンの存在確認
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
  });

  test('未認証で保護ページにアクセスするとログインにリダイレクトされる', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未認証でプロジェクトページにアクセスするとログインにリダイレクトされる', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });
});
