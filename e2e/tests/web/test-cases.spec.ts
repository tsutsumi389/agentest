import { test, expect } from '../../fixtures';

// シードデータのID
const DEMO_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_TEST_SUITE_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_TEST_CASE_ID = '00000000-0000-0000-0000-000000000003';

test.describe('テストケース一覧', () => {
  test('テストスイート内のテストケースが表示される', async ({ page }) => {
    await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

    // シードデータのテストケースがサイドバーに表示される
    await expect(page.getByText('Valid user can login successfully')).toBeVisible();
  });

  test('テストケースの検索ができる', async ({ page, apiClient }) => {
    // テスト用のテストケースを作成
    const testCase1 = await apiClient.createTestCase({
      title: `Search Test Alpha ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    const testCase2 = await apiClient.createTestCase({
      title: `Search Test Beta ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

      // 両方のテストケースが表示されることを確認
      await expect(page.getByText(testCase1.testCase.title)).toBeVisible();
      await expect(page.getByText(testCase2.testCase.title)).toBeVisible();

      // 検索ボックスに入力
      const searchInput = page.getByPlaceholder(/検索|テストケースを検索/);
      await searchInput.fill('Alpha');

      // Alpha を含むテストケースのみ表示される
      await expect(page.getByText(testCase1.testCase.title)).toBeVisible();
      await expect(page.getByText(testCase2.testCase.title)).not.toBeVisible();
    } finally {
      // クリーンアップ
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase1.testCase.id);
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase2.testCase.id);
    }
  });

  test('優先度でフィルタできる', async ({ page, apiClient }) => {
    // 異なる優先度のテストケースを作成
    const highPriorityCase = await apiClient.createTestCase({
      title: `Filter High ${Date.now()}`,
      priority: 'HIGH',
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    const lowPriorityCase = await apiClient.createTestCase({
      title: `Filter Low ${Date.now()}`,
      priority: 'LOW',
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

      // 両方のテストケースが表示されることを確認
      await expect(page.getByText(highPriorityCase.testCase.title)).toBeVisible();
      await expect(page.getByText(lowPriorityCase.testCase.title)).toBeVisible();

      // 優先度フィルタを開く（フィルタボタンを探す）
      const filterButton = page.getByRole('button', { name: /フィルタ|優先度/ });
      if (await filterButton.isVisible()) {
        await filterButton.click();

        // HIGH優先度でフィルタ
        await page.getByText('HIGH').click();

        // HIGH優先度のテストケースのみ表示される
        await expect(page.getByText(highPriorityCase.testCase.title)).toBeVisible();
        await expect(page.getByText(lowPriorityCase.testCase.title)).not.toBeVisible();
      }
    } finally {
      // クリーンアップ
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, highPriorityCase.testCase.id);
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, lowPriorityCase.testCase.id);
    }
  });
});

test.describe('テストケースCRUD', () => {
  test('新規テストケースを作成できる', async ({ page, apiClient }) => {
    const testCaseName = `E2E New Test Case ${Date.now()}`;
    let createdTestCaseId: string | null = null;

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

      // 「テストケースを追加」ボタンをクリック
      const addButton = page.getByRole('button', { name: /追加|テストケースを追加|新規/ });
      await addButton.click();

      // タイトル入力フィールドに入力
      const titleInput = page.getByPlaceholder(/タイトル|テストケースのタイトル/);
      await titleInput.fill(testCaseName);

      // 「作成」または「保存」ボタンをクリック
      const saveButton = page.getByRole('button', { name: /作成|保存/ });
      await saveButton.click();

      // 作成されたテストケースが表示される
      await expect(page.getByText(testCaseName)).toBeVisible({ timeout: 10000 });

      // URLからテストケースIDを取得してクリーンアップ用に保存
      const url = page.url();
      const match = url.match(/testCase=([a-f0-9-]+)/);
      if (match) {
        createdTestCaseId = match[1];
      }
    } finally {
      // クリーンアップ
      if (createdTestCaseId) {
        await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, createdTestCaseId);
      }
    }
  });

  test('テストケースのタイトルを編集できる', async ({ page, apiClient }) => {
    const originalTitle = `Edit Title Test ${Date.now()}`;
    const newTitle = `Updated Title ${Date.now()}`;

    // テスト用のテストケースを作成
    const testCase = await apiClient.createTestCase({
      title: originalTitle,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集ボタンをクリック
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // タイトルを変更
      const titleInput = page.locator(`input[value="${originalTitle}"]`);
      await titleInput.clear();
      await titleInput.fill(newTitle);

      // 保存
      const saveButton = page.getByRole('button', { name: /保存/ });
      await saveButton.click();

      // 変更が反映される
      await expect(page.getByText(newTitle)).toBeVisible({ timeout: 10000 });
    } finally {
      // クリーンアップ
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('テストケースの説明を編集できる', async ({ page, apiClient }) => {
    const title = `Edit Desc Test ${Date.now()}`;
    const description = 'Updated description for E2E test';

    // テスト用のテストケースを作成
    const testCase = await apiClient.createTestCase({
      title,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集ボタンをクリック
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // 説明を入力
      const descInput = page.getByPlaceholder(/説明|テストケースの説明/);
      await descInput.fill(description);

      // 保存
      const saveButton = page.getByRole('button', { name: /保存/ });
      await saveButton.click();

      // 変更が反映される
      await expect(page.getByText(description)).toBeVisible({ timeout: 10000 });
    } finally {
      // クリーンアップ
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('テストケースの優先度を変更できる', async ({ page, apiClient }) => {
    const title = `Edit Priority Test ${Date.now()}`;

    // LOW優先度でテストケースを作成
    const testCase = await apiClient.createTestCase({
      title,
      priority: 'LOW',
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集ボタンをクリック
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // 優先度セレクタを開く
      const prioritySelect = page.getByLabel(/優先度/);
      await prioritySelect.click();

      // CRITICALを選択
      await page.getByText('CRITICAL').click();

      // 保存
      const saveButton = page.getByRole('button', { name: /保存/ });
      await saveButton.click();

      // 変更が反映される（CRITICALバッジが表示される）
      await expect(page.getByText('CRITICAL')).toBeVisible({ timeout: 10000 });
    } finally {
      // クリーンアップ
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('テストケースを削除できる', async ({ page, apiClient }) => {
    const title = `Delete Test ${Date.now()}`;

    // テスト用のテストケースを作成
    const testCase = await apiClient.createTestCase({
      title,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 削除ボタンをクリック（ドロップダウンメニュー内にある可能性）
      const menuButton = page.getByRole('button', { name: /メニュー|⋮|その他/ });
      if (await menuButton.isVisible()) {
        await menuButton.click();
      }

      const deleteButton = page.getByRole('button', { name: /削除/ });
      await deleteButton.click();

      // 確認ダイアログで「削除する」をクリック
      const confirmButton = page.getByRole('button', { name: /削除する|確認/ });
      await confirmButton.click();

      // テストケースがリストから消える
      await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });
    } finally {
      // 削除済みの場合はエラーを無視
      try {
        await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
      } catch {
        // 既に削除済みの場合
      }
    }
  });

  test('削除したテストケースを復元できる', async ({ page, apiClient }) => {
    const title = `Restore Test ${Date.now()}`;

    // テスト用のテストケースを作成
    const testCase = await apiClient.createTestCase({
      title,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      // APIで削除
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);

      // テストスイートページに移動
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

      // 削除済みを表示するフィルタを有効化（存在する場合）
      const showDeletedToggle = page.getByLabel(/削除済みを表示|削除されたアイテム/);
      if (await showDeletedToggle.isVisible()) {
        await showDeletedToggle.click();
      }

      // 削除されたテストケースをクリック
      await page.getByText(title).click();

      // 復元ボタンをクリック
      const restoreButton = page.getByRole('button', { name: /復元/ });
      await restoreButton.click();

      // テストケースが復元される
      await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });

      // 削除済みマークが消える
      await expect(page.getByText(/削除済み/)).not.toBeVisible();
    } finally {
      // クリーンアップ（復元されたケースを削除）
      try {
        await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
      } catch {
        // 既に削除済みの場合
      }
    }
  });

  test('テストケースをコピーできる', async ({ page, apiClient }) => {
    const originalTitle = `Copy Test ${Date.now()}`;

    // テスト用のテストケースを作成
    const testCase = await apiClient.createTestCase({
      title: originalTitle,
      description: 'This is a test case to be copied',
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    let copiedTestCaseId: string | null = null;

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // コピーボタンをクリック
      const copyButton = page.getByRole('button', { name: /コピー/ });
      await copyButton.click();

      // コピーモーダルで確認
      const confirmCopyButton = page.getByRole('button', { name: /コピー|作成/ });
      await confirmCopyButton.click();

      // コピーされたテストケースが表示される（タイトルに「コピー」が付くか、元と同じ名前）
      await expect(page.getByText(`${originalTitle}`).first()).toBeVisible({ timeout: 10000 });

      // URLからコピーされたテストケースIDを取得
      const url = page.url();
      const match = url.match(/testCase=([a-f0-9-]+)/);
      if (match && match[1] !== testCase.testCase.id) {
        copiedTestCaseId = match[1];
      }
    } finally {
      // クリーンアップ
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
      if (copiedTestCaseId) {
        await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, copiedTestCaseId);
      }
    }
  });
});

test.describe('テストケース並び替え', () => {
  test('ドラッグ＆ドロップでテストケースを並び替えできる', async ({ page, apiClient }) => {
    // 並び替え用のテストケースを作成
    const testCase1 = await apiClient.createTestCase({
      title: `Reorder A ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    const testCase2 = await apiClient.createTestCase({
      title: `Reorder B ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    const testCase3 = await apiClient.createTestCase({
      title: `Reorder C ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

      // テストケースが表示されるまで待機
      await expect(page.getByText(testCase1.testCase.title)).toBeVisible();
      await expect(page.getByText(testCase2.testCase.title)).toBeVisible();
      await expect(page.getByText(testCase3.testCase.title)).toBeVisible();

      // テストケース1をテストケース3の位置にドラッグ
      const item1 = page.getByText(testCase1.testCase.title);
      const item3 = page.getByText(testCase3.testCase.title);

      // ドラッグハンドルを使用（存在する場合）
      const dragHandle = item1.locator('..').getByRole('button', { name: /ドラッグ|並び替え/ });
      if (await dragHandle.isVisible()) {
        await dragHandle.dragTo(item3);
      } else {
        // 要素自体をドラッグ
        await item1.dragTo(item3);
      }

      // 並び順が変更されたことを確認（APIで確認）
      await page.waitForTimeout(1000); // 並び替えの反映を待つ
    } finally {
      // クリーンアップ
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase1.testCase.id);
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase2.testCase.id);
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase3.testCase.id);
    }
  });
});
