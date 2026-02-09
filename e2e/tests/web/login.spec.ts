import { test, expect } from '../../fixtures';

// ログインページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('ログインページ', () => {
  test('未認証ユーザーにログインページが表示される', async ({ page }) => {
    await page.goto('/login');

    // ページタイトルの確認
    await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();

    // メール/パスワードフォームの存在確認
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('パスワード')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログイン', exact: true })).toBeVisible();

    // パスワードリセットリンクの確認
    await expect(page.getByRole('link', { name: 'パスワードをお忘れですか？' })).toBeVisible();

    // 区切り線「または」の確認
    await expect(page.getByText('または')).toBeVisible();

    // GitHubログインボタンの存在確認
    await expect(page.getByRole('button', { name: /GitHub/i })).toBeVisible();

    // Googleログインボタンの存在確認
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();

    // 新規登録リンクの確認
    await expect(page.getByRole('link', { name: '新規登録' })).toBeVisible();
  });

  test('新規登録リンクがサインアップページに遷移する', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: '新規登録' }).click();
    await expect(page).toHaveURL(/\/register/);
    await expect(page.getByRole('heading', { name: 'アカウント作成' })).toBeVisible();
  });

  test('パスワードリセットリンクがリセットページに遷移する', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('link', { name: 'パスワードをお忘れですか？' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'パスワードリセット' })).toBeVisible();
  });

  test('未認証で保護ページにアクセスするとログインにリダイレクトされる', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('未認証でプロジェクトページにアクセスするとログインにリダイレクトされる', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/login/);
  });

  test('メール未確認ユーザーのログイン時にメール確認ページにリダイレクトされる', async ({ page }) => {
    await page.goto('/login');

    const testEmail = 'unverified@example.com';

    // ログインAPIをモック（EMAIL_NOT_VERIFIEDエラーを返す）
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            message: 'メールアドレスが確認されていません。受信トレイの確認メールをご確認ください',
            code: 'EMAIL_NOT_VERIFIED',
          },
        }),
      });
    });

    // フォームを入力してログイン
    await page.getByLabel('メールアドレス').fill(testEmail);
    await page.getByLabel('パスワード').fill('Test1234!');
    await page.getByRole('button', { name: 'ログイン', exact: true }).click();

    // メール確認ページにリダイレクトされる
    await expect(page).toHaveURL(new RegExp(`/check-email\\?email=${encodeURIComponent(testEmail)}`));
    await expect(page.getByRole('heading', { name: 'メールアドレスの確認' })).toBeVisible();
  });
});
