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
    await expect(page.getByText('表示名')).toBeVisible();

    // メールアドレスフィールドが表示される
    await expect(page.getByText('メールアドレス', { exact: true })).toBeVisible();
  });

  test('表示名を変更できる', async ({ page }) => {
    await page.goto('/settings');

    // 表示名フィールドを取得（ラベルの次のinput）
    await expect(page.getByText('表示名')).toBeVisible();
    const nameInput = page.locator('input[type="text"]').first();
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
    await expect(page.getByText('表示名')).toBeVisible();
    const nameInput = page.locator('input[type="text"]').first();
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

test.describe('パスワード管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=security');
  });

  test('パスワードセクションが表示される', async ({ page }) => {
    // パスワードセクションが表示される
    await expect(page.getByRole('heading', { name: 'パスワード' })).toBeVisible({ timeout: 10000 });

    // デモユーザーはOAuth専用のためパスワード未設定
    await expect(page.getByText('パスワードが設定されていません')).toBeVisible({ timeout: 10000 });

    // パスワード設定ボタンが表示される
    await expect(page.getByRole('button', { name: 'パスワードを設定' })).toBeVisible();
  });

  test('パスワード設定モーダルが開く', async ({ page }) => {
    // パスワードセクションの読み込みを待機
    await expect(page.getByRole('heading', { name: 'パスワード' })).toBeVisible({ timeout: 10000 });

    // パスワード設定ボタンをクリック
    await page.getByRole('button', { name: 'パスワードを設定' }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: 'パスワードを設定する' })).toBeVisible();

    // フォーム要素の確認
    await expect(page.getByLabel('新しいパスワード')).toBeVisible();
    await expect(page.getByLabel('パスワード（確認）')).toBeVisible();

    // ボタンの確認
    await expect(page.getByRole('button', { name: 'キャンセル' })).toBeVisible();
    await expect(page.getByRole('button', { name: '設定する' })).toBeVisible();
  });

  test('パスワード設定モーダルをキャンセルで閉じられる', async ({ page }) => {
    // パスワードセクションの読み込みを待機
    await expect(page.getByRole('heading', { name: 'パスワード' })).toBeVisible({ timeout: 10000 });

    // モーダルを開く
    await page.getByRole('button', { name: 'パスワードを設定' }).click();
    await expect(page.getByRole('heading', { name: 'パスワードを設定する' })).toBeVisible();

    // キャンセルで閉じる
    await page.getByRole('button', { name: 'キャンセル' }).click();

    // モーダルが閉じる
    await expect(page.getByRole('heading', { name: 'パスワードを設定する' })).not.toBeVisible();
  });
});

test.describe('セキュリティ設定', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=security');
  });

  test('接続済みアカウント一覧が表示される', async ({ page }) => {
    // 接続済みアカウントセクションが表示される
    await expect(page.getByRole('heading', { name: '接続済みアカウント' })).toBeVisible({ timeout: 10000 });

    // OAuthプロバイダーが表示される
    await expect(page.getByText('GitHub')).toBeVisible();
  });

  test('ログインセッション一覧が表示される', async ({ page }) => {
    // アクティブなセッションセクションが表示される
    await expect(page.getByRole('heading', { name: 'アクティブなセッション' })).toBeVisible({ timeout: 10000 });

    // 現在のセッションが表示される
    await expect(page.getByText('現在のセッション')).toBeVisible({ timeout: 10000 });
  });

  test('セッション情報にデバイス情報が含まれる', async ({ page }) => {
    // セッション情報が表示されるまで待機
    await expect(page.getByText('現在のセッション')).toBeVisible({ timeout: 10000 });

    // ブラウザとOS情報（例：Chrome on macOS）が表示される
    await expect(page.getByText('Chrome on macOS').first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('APIトークン管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings?tab=api-tokens');
  });

  test('APIトークンセクションが表示される', async ({ page }) => {
    // APIトークンセクションが表示される
    await expect(page.getByRole('heading', { name: 'APIトークン' })).toBeVisible({ timeout: 10000 });

    // 説明テキストが表示される
    await expect(page.getByText(/MCP.*サーバー|CI.*CD/)).toBeVisible();

    // 新規作成ボタンが表示される
    await expect(page.getByRole('button', { name: /新しいトークン/ })).toBeVisible();
  });

  test('APIトークンを作成できる', async ({ page }) => {
    const tokenName = `E2E Token ${Date.now()}`;

    // 「新しいトークンを生成」ボタンをクリック
    await page.getByRole('button', { name: '新しいトークンを生成' }).click();

    // モーダルが表示される（トークン名入力フィールドのプレースホルダーで特定）
    const tokenNameInput = page.getByPlaceholder('例: CI/CD Pipeline');
    await expect(tokenNameInput).toBeVisible({ timeout: 5000 });

    // トークン名を入力
    await tokenNameInput.fill(tokenName);

    // 作成ボタンをクリック（有効化されるのを待つ）
    const createButton = page.getByRole('button', { name: '作成', exact: true });
    await expect(createButton).toBeEnabled({ timeout: 3000 });
    await createButton.click();

    // トークンが作成される（トーストメッセージ）
    await expect(page.getByText('APIトークンを作成しました')).toBeVisible({ timeout: 10000 });
  });

  test('APIトークン一覧が表示される', async ({ page }) => {
    // トークンがある場合はリストが表示される、なければ空メッセージ
    await expect(
      page.getByText('アクティブなAPIトークンがありません').or(
        page.getByText(/agentest_/).first()
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('APIトークンを失効できる', async ({ page, apiClient }) => {
    // テスト用トークンをAPI経由で作成
    const tokenName = `E2E Revoke Token ${Date.now()}`;
    await apiClient.createApiToken({ name: tokenName });

    // ページをリロードしてトークン一覧の読み込みを待つ
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 作成したトークンが表示される
    await expect(page.getByText(tokenName)).toBeVisible({ timeout: 15000 });

    // トークン行の構造: div > [div(info with tokenName), button(delete)]
    // トークン名を含む要素を見つけ、その隣にあるボタンを探す
    // 各トークン項目のコンテナを見つける
    const tokenNameElement = page.getByText(tokenName, { exact: true });

    // トークン名要素の親をたどって、ボタンを持つコンテナを見つける
    // コンテナはトークン名とcodeとbuttonを子孫に持つ最も近いdiv
    const tokenContainer = page.locator('div').filter({ hasText: tokenName }).filter({ has: page.locator('code') }).filter({ has: page.locator('> button') }).first();

    // コンテナ内のボタンをクリック
    await tokenContainer.locator('> button').click();

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
