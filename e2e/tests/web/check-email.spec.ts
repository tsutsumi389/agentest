import { test, expect } from '../../fixtures';

// メール確認待ちページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('メール確認待ちページ', () => {
  test('メールアドレス付きでアクセスすると確認案内が表示される', async ({ page }) => {
    await page.goto('/check-email?email=test@example.com');

    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: 'メールアドレスの確認' })).toBeVisible();

    // 案内メッセージの確認
    await expect(page.getByText('確認メールを送信しました')).toBeVisible();
    await expect(page.getByText('test@example.com')).toBeVisible();
    await expect(page.getByText('受信トレイを確認してください。')).toBeVisible();
    await expect(
      page.getByText('メール内のリンクをクリックしてアカウントを有効化してください。')
    ).toBeVisible();

    // 再送信ボタンの確認
    await expect(page.getByRole('button', { name: '確認メールを再送信' })).toBeVisible();

    // ログインに戻るリンクの確認
    await expect(page.getByRole('link', { name: 'ログインに戻る' })).toBeVisible();
  });

  test('メールアドレスなしでアクセスすると再送信ボタンが表示されない', async ({ page }) => {
    await page.goto('/check-email');

    // ページタイトルと案内メッセージは表示される
    await expect(page.getByRole('heading', { name: 'メールアドレスの確認' })).toBeVisible();
    await expect(page.getByText('確認メールを送信しました')).toBeVisible();

    // 再送信ボタンは表示されない（emailがないため）
    await expect(page.getByRole('button', { name: '確認メールを再送信' })).not.toBeVisible();

    // ログインに戻るリンクは表示される
    await expect(page.getByRole('link', { name: 'ログインに戻る' })).toBeVisible();
  });

  test('ログインに戻るリンクがログインページに遷移する', async ({ page }) => {
    await page.goto('/check-email?email=test@example.com');

    await page.getByRole('link', { name: 'ログインに戻る' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
  });

  test('再送信ボタンクリック後にフィードバックが表示される', async ({ page }) => {
    await page.goto('/check-email?email=test@example.com');

    // APIレスポンスをモック（fire-and-forget型なので常に成功を返す）
    await page.route('**/api/auth/resend-verification', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: '確認メールを送信しました' }),
      });
    });

    await page.getByRole('button', { name: '確認メールを再送信' }).click();

    // 再送信完了メッセージが表示される
    await expect(page.getByText('確認メールを再送信しました')).toBeVisible();
  });
});
