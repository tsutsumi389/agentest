import { test, expect } from '../../fixtures';

// メール確認ページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('メールアドレス確認ページ', () => {
  test('トークンなしでアクセスするとエラーが表示される', async ({ page }) => {
    await page.goto('/verify-email');

    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: 'メールアドレスの確認' })).toBeVisible();

    // エラーメッセージの確認
    await expect(page.getByText('確認トークンが見つかりません')).toBeVisible();

    // 案内テキストの確認
    await expect(page.getByText('リンクが無効または期限切れの可能性があります。')).toBeVisible();

    // ログインに戻るリンクの確認
    await expect(page.getByRole('link', { name: 'ログインに戻る' })).toBeVisible();
  });

  test('有効なトークンで確認成功メッセージが表示される', async ({ page }) => {
    // APIレスポンスをモック（成功）
    await page.route('**/api/auth/verify-email**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'メールアドレスが確認されました' }),
      });
    });

    await page.goto('/verify-email?token=valid-test-token');

    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: 'メールアドレスの確認' })).toBeVisible();

    // 成功メッセージの確認
    await expect(page.getByText('メールアドレスが確認されました')).toBeVisible();
    await expect(page.getByText('アカウントが有効化されました。ログインしてご利用ください。')).toBeVisible();

    // ログインボタンの確認
    await expect(page.getByRole('link', { name: 'ログインする' })).toBeVisible();
  });

  test('無効なトークンでエラーが表示される', async ({ page }) => {
    // APIレスポンスをモック（失敗）
    await page.route('**/api/auth/verify-email**', (route) => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: '確認トークンが無効または期限切れです', code: 'INVALID_TOKEN' } }),
      });
    });

    await page.goto('/verify-email?token=invalid-token');

    // エラーメッセージの確認
    await expect(page.getByRole('alert')).toBeVisible();

    // 案内テキストの確認
    await expect(page.getByText('リンクが無効または期限切れの可能性があります。')).toBeVisible();

    // ログインに戻るリンクの確認
    await expect(page.getByRole('link', { name: 'ログインに戻る' })).toBeVisible();
  });

  test('確認成功後にログインリンクがログインページに遷移する', async ({ page }) => {
    // APIレスポンスをモック（成功）
    await page.route('**/api/auth/verify-email**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'メールアドレスが確認されました' }),
      });
    });

    await page.goto('/verify-email?token=valid-test-token');

    // 成功メッセージを待つ
    await expect(page.getByText('メールアドレスが確認されました')).toBeVisible();

    // ログインリンクをクリック
    await page.getByRole('link', { name: 'ログインする' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });

  test('エラー時にログインに戻るリンクがログインページに遷移する', async ({ page }) => {
    await page.goto('/verify-email');

    // エラー状態を待つ
    await expect(page.getByText('確認トークンが見つかりません')).toBeVisible();

    // ログインに戻るリンクをクリック
    await page.getByRole('link', { name: 'ログインに戻る' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });
});
