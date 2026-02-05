import { test, expect } from '../../fixtures';

test.describe('プロフィール設定', () => {
  test('プロフィール情報が表示される', async ({ page }) => {
    // 設定ページに遷移
    await page.goto('/settings');

    // ページタイトルが表示される
    await expect(page.getByRole('heading', { name: '設定' })).toBeVisible();

    // プロフィールセクションが表示される
    await expect(page.getByRole('heading', { name: 'プロフィール' })).toBeVisible();

    // 表示名フィールドが表示される
    await expect(page.getByLabel('表示名')).toBeVisible();

    // メールアドレスフィールドが表示される（disabled）
    await expect(page.getByLabel('メールアドレス')).toBeVisible();
    await expect(page.getByLabel('メールアドレス')).toBeDisabled();
  });

  test('表示名を変更できる', async ({ page }) => {
    await page.goto('/settings');

    // 表示名フィールドを取得
    const nameInput = page.getByLabel('表示名');
    const originalName = await nameInput.inputValue();

    // 新しい名前を入力
    const newName = `E2E User ${Date.now()}`;
    await nameInput.fill(newName);

    // 保存ボタンが有効になる
    const saveButton = page.getByRole('button', { name: '保存' });
    await expect(saveButton).toBeEnabled();

    // 保存
    await saveButton.click();

    // 成功メッセージが表示される
    await expect(page.getByText('プロフィールを更新しました')).toBeVisible({ timeout: 10000 });

    // 元の名前に戻す
    await nameInput.fill(originalName);
    await saveButton.click();
    await expect(page.getByText('プロフィールを更新しました')).toBeVisible({ timeout: 10000 });
  });

  test('変更をキャンセルできる', async ({ page }) => {
    await page.goto('/settings');

    // 表示名フィールドを取得
    const nameInput = page.getByLabel('表示名');
    const originalName = await nameInput.inputValue();

    // 新しい名前を入力
    await nameInput.fill(`Temp Name ${Date.now()}`);

    // キャンセルボタンが表示される
    const cancelButton = page.getByRole('button', { name: 'キャンセル' });
    await expect(cancelButton).toBeVisible();

    // キャンセル
    await cancelButton.click();

    // 元の名前に戻る
    await expect(nameInput).toHaveValue(originalName);
  });
});

test.describe('セキュリティ設定', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=security');
  });

  test('接続済みアカウント一覧が表示される', async ({ page }) => {
    // セキュリティタブに遷移
    await expect(page.getByRole('heading', { name: '接続済みアカウント' })).toBeVisible();

    // OAuthプロバイダーが表示される
    await expect(page.getByText('GitHub').or(page.getByText('Google'))).toBeVisible();
  });

  test('ログインセッション一覧が表示される', async ({ page }) => {
    // アクティブなセッションセクションが表示される
    await expect(page.getByRole('heading', { name: 'アクティブなセッション' })).toBeVisible();

    // 現在のセッションが表示される
    await expect(page.getByText('現在のセッション')).toBeVisible({ timeout: 10000 });
  });

  test('セッション情報にデバイス情報が含まれる', async ({ page }) => {
    // セッション情報が表示されるまで待機
    await expect(page.getByText('現在のセッション')).toBeVisible({ timeout: 10000 });

    // ブラウザまたはOS情報が表示される
    await expect(
      page.getByText(/Chrome|Firefox|Safari|Edge/).first().or(
        page.getByText(/Windows|macOS|Linux/).first()
      )
    ).toBeVisible();
  });
});

test.describe('APIトークン管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=api-tokens');
  });

  test('APIトークンセクションが表示される', async ({ page }) => {
    // APIトークンセクションが表示される
    await expect(page.getByRole('heading', { name: 'APIトークン' })).toBeVisible();

    // 説明テキストが表示される
    await expect(page.getByText(/MCP.*サーバー|CI.*CD/)).toBeVisible();

    // 新規作成ボタンが表示される
    await expect(page.getByRole('button', { name: /新しいトークン/ })).toBeVisible();
  });

  test('APIトークンを作成できる', async ({ page }) => {
    const tokenName = `E2E Token ${Date.now()}`;

    // 「新しいトークンを生成」ボタンをクリック
    await page.getByRole('button', { name: /新しいトークン/ }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: '新しいAPIトークンを作成' })).toBeVisible();

    // トークン名を入力
    await page.getByPlaceholder(/CI.*CD/).fill(tokenName);

    // 作成ボタンをクリック
    await page.getByRole('button', { name: '作成', exact: true }).click();

    // トークンが作成される
    await expect(page.getByText('APIトークンを作成しました').or(
      page.getByText('トークンが作成されました')
    )).toBeVisible({ timeout: 10000 });
  });

  test('APIトークン一覧が表示される', async ({ page }) => {
    // トークンがある場合はリストが表示される、なければ空メッセージ
    await expect(
      page.getByText('アクティブなAPIトークンがありません').or(
        page.locator('[class*="token"], [class*="Token"]').first()
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('APIトークンを失効できる', async ({ page, apiClient }) => {
    // テスト用トークンをAPI経由で作成
    const tokenName = `E2E Revoke Token ${Date.now()}`;
    await apiClient.createApiToken({ name: tokenName });

    // ページをリロード
    await page.reload();

    // 作成したトークンが表示される
    await expect(page.getByText(tokenName)).toBeVisible({ timeout: 10000 });

    // 失効ボタン（ゴミ箱アイコン）をクリック
    const tokenRow = page.locator('[class*="token"], [class*="Token"]', { hasText: tokenName });
    await tokenRow.getByRole('button').click();

    // 確認ダイアログで「失効する」をクリック
    await page.getByRole('button', { name: '失効する' }).click();

    // 成功メッセージが表示される
    await expect(page.getByText('APIトークンを失効しました')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('課金設定', () => {
  test('現在のプランが表示される', async ({ page }) => {
    await page.goto('/settings?tab=billing');

    // 課金セクションまたはプラン情報が表示される
    await expect(
      page.getByText(/プラン|Free|Basic|Pro/).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('課金関連の情報が表示される', async ({ page }) => {
    await page.goto('/settings?tab=billing');

    // 課金に関する情報が表示される（請求履歴、支払い方法など）
    await expect(
      page.getByText(/請求|支払い|プラン|利用/).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
