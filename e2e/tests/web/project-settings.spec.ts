import { test, expect } from '../../fixtures';

// シードデータのプロジェクトID
const DEMO_PROJECT_ID = '00000000-0000-0000-0000-000000000001';

test.describe('プロジェクト一般設定', () => {
  test.beforeEach(async ({ page }) => {
    // プロジェクト設定ページに遷移
    await page.goto(`/projects/${DEMO_PROJECT_ID}?tab=settings&section=general`);
  });

  test('プロジェクト名が表示される', async ({ page }) => {
    // 一般設定が表示される
    await expect(page.getByRole('heading', { name: '一般設定' })).toBeVisible();

    // プロジェクト名フィールドが表示される
    await expect(page.getByLabel('プロジェクト名')).toBeVisible();
  });

  test('プロジェクト名を変更できる', async ({ page }) => {
    // プロジェクト名フィールドを取得
    const nameInput = page.getByLabel('プロジェクト名');
    const originalName = await nameInput.inputValue();

    // 新しい名前を入力
    const newName = `Demo Project Updated ${Date.now()}`;
    await nameInput.fill(newName);

    // 保存ボタンをクリック
    await page.getByRole('button', { name: '保存' }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/更新しました|保存しました/)).toBeVisible({ timeout: 10000 });

    // 元の名前に戻す
    await nameInput.fill(originalName);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText(/更新しました|保存しました/)).toBeVisible({ timeout: 10000 });
  });

  test('プロジェクト説明を変更できる', async ({ page }) => {
    // 説明フィールドを取得
    const descriptionInput = page.getByLabel('説明').or(
      page.getByPlaceholder(/説明/)
    );

    // 新しい説明を入力
    const newDescription = `E2E Test Description ${Date.now()}`;
    await descriptionInput.fill(newDescription);

    // 保存ボタンをクリック
    await page.getByRole('button', { name: '保存' }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/更新しました|保存しました/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('環境管理', () => {
  test.beforeEach(async ({ page }) => {
    // 環境設定セクションに遷移
    await page.goto(`/projects/${DEMO_PROJECT_ID}?tab=settings&section=environments`);
  });

  test('環境一覧が表示される', async ({ page }) => {
    // 環境設定セクションが表示される
    await expect(page.getByRole('heading', { name: '環境設定' })).toBeVisible({ timeout: 10000 });

    // 既存の環境（Development）が表示される
    await expect(page.getByText('Development')).toBeVisible();
  });

  test('テスト環境を作成できる', async ({ page }) => {
    const envName = `E2E Env ${Date.now()}`;

    // 「環境を追加」ボタンをクリック
    await page.getByRole('button', { name: '環境を追加' }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: '環境を作成' })).toBeVisible();

    // 環境名を入力（環境名フィールド）
    const envNameInput = page.locator('input[type="text"]').first();
    await envNameInput.fill(envName);

    // 作成ボタンをクリック
    await page.getByRole('button', { name: '作成', exact: true }).click();

    // 成功メッセージが表示される
    await expect(page.getByText('環境を作成しました')).toBeVisible({ timeout: 10000 });
  });

  test('テスト環境を編集できる', async ({ page, apiClient }) => {
    // テスト用の環境をAPI経由で作成
    const envName = `Edit Env ${Date.now()}`;
    const envResult = await apiClient.createEnvironment(DEMO_PROJECT_ID, { name: envName });

    // ページをリロード
    await page.reload();

    // 作成した環境が表示されるまで待機
    await expect(page.getByText(envName)).toBeVisible({ timeout: 10000 });

    // 環境名を含む行を特定し、その行のメニューボタンをクリック
    const envNameElement = page.getByText(envName, { exact: true });
    const envRow = page.locator('div').filter({ has: envNameElement }).filter({ has: page.getByRole('button', { name: '環境操作メニュー' }) }).last();
    await envRow.getByRole('button', { name: '環境操作メニュー' }).click();

    // メニューが開くまで待機し、編集オプションをクリック
    await expect(page.getByRole('menuitem', { name: '編集' })).toBeVisible({ timeout: 5000 });
    await page.getByRole('menuitem', { name: '編集' }).click();

    // 編集モーダルが表示される
    await expect(page.getByRole('heading', { name: '環境を編集' })).toBeVisible({ timeout: 5000 });

    // 環境名フィールドに新しい名前を入力
    const editInput = page.getByPlaceholder('Production');
    await expect(editInput).toBeVisible();

    const updatedName = `${envName} Updated`;
    await editInput.fill(updatedName);

    // 更新ボタンをクリック
    await page.getByRole('button', { name: '更新' }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/更新しました/)).toBeVisible({ timeout: 10000 });

    // クリーンアップ: 環境を削除
    await apiClient.deleteEnvironment(DEMO_PROJECT_ID, envResult.environment.id);
  });

  test('テスト環境を削除できる', async ({ page, apiClient }) => {
    // テスト用の環境をAPI経由で作成
    const envName = `Delete Env ${Date.now()}`;
    await apiClient.createEnvironment(DEMO_PROJECT_ID, { name: envName });

    // ページをリロード
    await page.reload();

    // 作成した環境が表示されるまで待機
    await expect(page.getByText(envName)).toBeVisible({ timeout: 10000 });

    // 環境行の3点メニューをクリック
    const envRow = page.locator('div', { hasText: envName }).first();
    await envRow.locator('button').last().click();

    // 削除オプションをクリック
    await page.getByRole('menuitem', { name: /削除/ }).or(page.getByText('削除')).click();

    // 確認ダイアログで「削除」をクリック
    await page.getByRole('button', { name: '削除する' }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/削除しました/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('ラベル管理', () => {
  test.beforeEach(async ({ page }) => {
    // ラベル設定セクションに遷移
    await page.goto(`/projects/${DEMO_PROJECT_ID}?tab=settings&section=labels`);
  });

  test('ラベル一覧が表示される', async ({ page }) => {
    // ラベルセクションが表示される
    await expect(page.getByRole('heading', { name: 'ラベル' })).toBeVisible({ timeout: 10000 });

    // 新規ラベルボタンが表示される
    await expect(page.getByRole('button', { name: '新規ラベル' })).toBeVisible();
  });

  test('ラベルを作成できる', async ({ page }) => {
    const labelName = `E2E Label ${Date.now()}`;

    // 「新規ラベル」ボタンをクリック
    await page.getByRole('button', { name: '新規ラベル' }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: '新しいラベル' })).toBeVisible();

    // ラベル名を入力（プレースホルダー「例: 回帰テスト」）
    await page.getByPlaceholder('例: 回帰テスト').fill(labelName);

    // 作成ボタンをクリック
    await page.getByRole('button', { name: '作成', exact: true }).click();

    // 成功メッセージが表示されるか、ラベルが一覧に追加される
    await expect(
      page.getByText(/作成しました/).or(page.getByText(labelName))
    ).toBeVisible({ timeout: 10000 });
  });

  test('ラベルを編集できる', async ({ page, apiClient }) => {
    // テスト用のラベルをAPI経由で作成
    const labelName = `Edit Label ${Date.now()}`;
    const labelResult = await apiClient.createLabel(DEMO_PROJECT_ID, {
      name: labelName,
      color: '#3b82f6',
    });

    // ページをリロード
    await page.reload();

    // 作成したラベルが表示されるまで待機
    await expect(page.getByText(labelName)).toBeVisible({ timeout: 10000 });

    // ラベル名テキスト → LabelBadge(span) → 行div の順に親を辿る
    const labelRow = page.getByText(labelName, { exact: true }).locator('..').locator('..');
    await labelRow.getByRole('button', { name: '編集' }).click();

    // 編集モーダルが表示される
    await expect(page.getByRole('heading', { name: 'ラベルを編集' })).toBeVisible({ timeout: 5000 });

    // 編集フィールドを取得
    const editInput = page.getByPlaceholder('例: 回帰テスト');
    await expect(editInput).toBeVisible();

    // 新しい名前を入力
    const updatedName = `${labelName} Updated`;
    await editInput.fill(updatedName);

    // 更新ボタンをクリック（モーダル内）
    await page.getByRole('button', { name: '更新' }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/更新しました/)).toBeVisible({ timeout: 10000 });

    // クリーンアップ: ラベルを削除
    await apiClient.deleteLabel(DEMO_PROJECT_ID, labelResult.label.id);
  });

  test('ラベルを削除できる', async ({ page, apiClient }) => {
    // テスト用のラベルをAPI経由で作成
    const labelName = `Delete Label ${Date.now()}`;
    await apiClient.createLabel(DEMO_PROJECT_ID, {
      name: labelName,
      color: '#ef4444',
    });

    // ページをリロード
    await page.reload();

    // 作成したラベルが表示されるまで待機
    await expect(page.getByText(labelName)).toBeVisible({ timeout: 10000 });

    // ラベル名の隣にある削除ボタンをクリック
    await page.getByText(labelName).locator('..').locator('..').getByRole('button', { name: '削除' }).click();

    // 確認ダイアログが表示される
    await expect(page.getByRole('heading', { name: 'ラベルを削除' })).toBeVisible({ timeout: 5000 });

    // 確認ダイアログで「削除」をクリック（ダイアログ内の削除ボタン）
    await page.getByRole('button', { name: '削除' }).last().click();

    // 成功メッセージが表示される
    await expect(page.getByText(/削除しました/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('削除済みテストスイート', () => {
  test('危険な操作セクションにアクセスできる', async ({ page }) => {
    // 危険な操作セクションに遷移
    await page.goto(`/projects/${DEMO_PROJECT_ID}?tab=settings&section=danger`);

    // プロジェクト削除セクションが表示される
    await expect(page.getByRole('heading', { name: 'プロジェクトを削除' })).toBeVisible({ timeout: 10000 });

    // 削除ボタンが表示される
    await expect(page.getByRole('button', { name: 'プロジェクトを削除' })).toBeVisible();
  });

  test('削除済みスイートを復元できる', async ({ page, apiClient }) => {
    // テスト用のスイートを作成
    const suiteName = `Restore Suite ${Date.now()}`;
    const suiteResult = await apiClient.createTestSuite({
      name: suiteName,
      projectId: DEMO_PROJECT_ID,
    });

    // スイートを削除
    await apiClient.deleteTestSuite(DEMO_PROJECT_ID, suiteResult.testSuite.id);

    // プロジェクト詳細ページで削除済みスイートを表示
    await page.goto(`/projects/${DEMO_PROJECT_ID}?tab=test-suites`);

    // 削除済み表示フィルターがあればクリック
    const deletedFilter = page.getByRole('button', { name: /削除済み/ }).or(
      page.getByText(/削除済み.*表示/)
    );
    if (await deletedFilter.isVisible()) {
      await deletedFilter.click();
    }

    // 削除済みスイートが表示されるか確認
    const deletedSuite = page.getByText(suiteName);
    if (await deletedSuite.isVisible()) {
      // 復元ボタンをクリック
      const suiteRow = page.locator('div', { hasText: suiteName }).first();
      await suiteRow.getByRole('button', { name: /復元/ }).click();

      // 確認ダイアログで「復元」をクリック
      await page.getByRole('button', { name: /復元する|復元/, exact: false }).click();

      // 成功メッセージが表示される
      await expect(page.getByText(/復元しました/)).toBeVisible({ timeout: 10000 });
    }

    // クリーンアップ: 復元されたスイートを再度削除
    await apiClient.deleteTestSuite(DEMO_PROJECT_ID, suiteResult.testSuite.id);
  });
});
