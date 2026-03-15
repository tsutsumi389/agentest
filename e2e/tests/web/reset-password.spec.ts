import { test, expect } from '../../fixtures';

// パスワードリセット実行ページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('パスワードリセット実行', () => {
  test('トークンなしでアクセスするとエラーが表示される', async ({ page }) => {
    await page.goto('/reset-password');

    // 無効なリンクメッセージが表示される
    await expect(page.getByText('無効なリンクです')).toBeVisible();

    // パスワードリセット再リクエストリンクが表示される
    await expect(
      page.getByRole('link', { name: 'パスワードリセットを再リクエスト' })
    ).toBeVisible();
  });

  test('トークンありでアクセスするとパスワード設定フォームが表示される', async ({ page }) => {
    // ダミートークン付きでアクセス（実際のリセットは実行しない）
    await page.goto('/reset-password?token=dummy-token');

    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: '新しいパスワードを設定' })).toBeVisible();

    // フォーム要素の確認
    await expect(page.getByLabel('新しいパスワード')).toBeVisible();
    await expect(page.getByLabel('パスワード（確認）')).toBeVisible();
    await expect(page.getByRole('button', { name: 'パスワードを変更' })).toBeVisible();
  });

  test('パスワード入力時に強度チェックリストが表示される', async ({ page }) => {
    await page.goto('/reset-password?token=dummy-token');

    // パスワードを入力
    await page.getByLabel('新しいパスワード').fill('abc');

    // パスワード強度チェックリストが表示される
    await expect(page.getByText('8文字以上')).toBeVisible();
    await expect(page.getByText('大文字を含む')).toBeVisible();
    await expect(page.getByText('小文字を含む')).toBeVisible();
    await expect(page.getByText('数字を含む')).toBeVisible();
    await expect(page.getByText('記号を含む')).toBeVisible();
  });

  test('パスワードリセット再リクエストリンクがforgot-passwordに遷移する', async ({ page }) => {
    await page.goto('/reset-password');

    await page.getByRole('link', { name: 'パスワードリセットを再リクエスト' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'パスワードリセット' })).toBeVisible();
  });
});
