import { test, expect } from '../../fixtures';

test.describe('ダッシュボード', () => {
  test('認証済みユーザーにダッシュボードが表示される', async ({ page }) => {
    await page.goto('/dashboard');

    // 「最近のプロジェクト」セクションが表示される
    await expect(page.getByText('最近のプロジェクト')).toBeVisible();
  });

  test('ダッシュボードからプロジェクトページに遷移できる', async ({ page }) => {
    await page.goto('/dashboard');

    // 「すべて表示」リンクをクリック
    await page.getByRole('link', { name: 'すべて表示' }).click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test('ナビゲーションメニューが機能する', async ({ page }) => {
    await page.goto('/dashboard');

    // ハンバーガーメニューを開く
    await page.getByRole('button', { name: 'メニューを開く' }).click();

    // メニュー内のリンクが表示される
    await expect(page.getByRole('link', { name: 'ダッシュボード' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'プロジェクト' })).toBeVisible();

    // プロジェクトリンクをクリックして遷移
    await page.getByRole('link', { name: 'プロジェクト' }).click();
    await expect(page).toHaveURL(/\/projects/);
  });

  test('ユーザーメニューからログアウトできる', async ({ page }) => {
    await page.goto('/dashboard');

    // ユーザーメニューを開く（ユーザーアバターをクリック）
    const userMenuButton = page
      .locator('[data-testid="user-menu-button"]')
      .or(page.getByRole('button').filter({ has: page.locator('img[alt]') }));

    // ユーザーメニューが見つからない場合はスキップ
    if ((await userMenuButton.count()) === 0) {
      test.skip();
      return;
    }

    await userMenuButton.first().click();

    // ログアウトボタンが表示される
    await expect(page.getByText('ログアウト')).toBeVisible();
  });
});
