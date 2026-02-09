import { test, expect } from '../../fixtures';

// パスワードリセットページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('パスワードリセットリクエスト', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('パスワードリセットフォームが表示される', async ({ page }) => {
    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: 'パスワードリセット' })).toBeVisible();

    // 説明テキストの確認
    await expect(page.getByText('登録されたメールアドレスにリセットリンクを送信します。')).toBeVisible();

    // フォーム要素の確認
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByRole('button', { name: 'リセットリンクを送信' })).toBeVisible();

    // ログインに戻るリンクの確認
    await expect(page.getByRole('link', { name: 'ログインに戻る' })).toBeVisible();
  });

  test('リセットリンク送信後に完了メッセージが表示される', async ({ page }) => {
    // メールアドレスを入力して送信
    await page.getByLabel('メールアドレス').fill('demo@agentest.dev');
    await page.getByRole('button', { name: 'リセットリンクを送信' }).click();

    // 送信完了メッセージが表示される
    await expect(page.getByText('メールを送信しました')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('受信トレイを確認してください。')).toBeVisible();

    // 再送信ボタンが表示される
    await expect(page.getByRole('button', { name: '再送信' })).toBeVisible();

    // ログインに戻るリンクが引き続き表示される
    await expect(page.getByRole('link', { name: 'ログインに戻る' })).toBeVisible();
  });

  test('ログインに戻るリンクがログインページに遷移する', async ({ page }) => {
    await page.getByRole('link', { name: 'ログインに戻る' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });
});
