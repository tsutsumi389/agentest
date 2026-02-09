import { test, expect } from '../../fixtures';

// 新規登録ページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('新規登録ページ', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('新規登録フォームが表示される', async ({ page }) => {
    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible();

    // フォーム要素の確認
    await expect(page.getByLabel('名前')).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード', { exact: true })).toBeVisible();
    await expect(page.getByLabel('パスワード（確認）')).toBeVisible();
    await expect(page.getByRole('button', { name: 'アカウント作成' })).toBeVisible();

    // 区切り線「または」の確認
    await expect(page.getByText('または')).toBeVisible();

    // OAuthボタンの確認
    await expect(page.getByRole('button', { name: /GitHubで登録/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Googleで登録/ })).toBeVisible();

    // ログインリンクの確認
    await expect(page.getByRole('link', { name: 'ログイン' })).toBeVisible();
  });

  test('パスワード入力時に強度チェックリストが表示される', async ({ page }) => {
    const passwordInput = page.getByLabel('パスワード', { exact: true });

    // 弱いパスワードを入力
    await passwordInput.fill('abc');

    // パスワード強度チェックリストが表示される
    await expect(page.getByText('8文字以上')).toBeVisible();
    await expect(page.getByText('大文字を含む')).toBeVisible();
    await expect(page.getByText('小文字を含む')).toBeVisible();
    await expect(page.getByText('数字を含む')).toBeVisible();
    await expect(page.getByText('記号を含む')).toBeVisible();
  });

  test('ログインリンクがログインページに遷移する', async ({ page }) => {
    await page.getByRole('link', { name: 'ログイン' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });
});
