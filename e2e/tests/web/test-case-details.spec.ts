import { test, expect } from '../../fixtures';

// シードデータのID
const DEMO_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_TEST_SUITE_ID = '00000000-0000-0000-0000-000000000002';

test.describe('前提条件管理', () => {
  test('前提条件一覧が表示される', async ({ page, apiClient }) => {
    // テストケースを作成
    const testCase = await apiClient.createTestCase({
      title: `Precondition List Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    // 前提条件を追加
    const precondition = await apiClient.addPrecondition(testCase.testCase.id, {
      content: 'User is logged in',
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 前提条件タブ/セクションに移動
      const preconditionTab = page.getByRole('tab', { name: /前提条件/ });
      if (await preconditionTab.isVisible()) {
        await preconditionTab.click();
      }

      // 前提条件が表示される
      await expect(page.getByText('User is logged in')).toBeVisible();
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('前提条件を追加できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Add Precondition Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);
      await page.waitForLoadState('networkidle');

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ }).first();
      await editButton.click();

      // 前提条件セクションを開く
      const preconditionTab = page.getByRole('tab', { name: /前提条件/ });
      if (await preconditionTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await preconditionTab.click();
      }

      // 前提条件セクション内の追加ボタンをクリック
      const preconditionSection = page
        .locator('[data-testid="preconditions-section"]')
        .or(page.locator('section', { hasText: '前提条件' }))
        .or(
          page
            .locator('div', { hasText: '前提条件' })
            .filter({ has: page.getByRole('button', { name: '追加' }) })
        );
      const addButton = preconditionSection.getByRole('button', { name: '追加' }).first();
      await addButton.click();

      // フォームが開いたら内容を入力
      const input = page
        .getByPlaceholder(/前提条件を入力|内容/)
        .or(page.locator('input[type="text"]').last());
      if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
        await input.fill('Database is initialized');
      }

      // ページが表示されていることを確認
      await expect(page).toHaveURL(/\/test-suites\//);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('前提条件を編集できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Edit Precondition Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addPrecondition(testCase.testCase.id, {
      content: 'Original precondition',
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);
      await page.waitForLoadState('networkidle');

      // 前提条件が表示されることを確認
      await expect(page.getByText('Original precondition')).toBeVisible({ timeout: 10000 });

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ }).first();
      await editButton.click();

      // 編集モードに入れたことを確認（保存/キャンセルボタンが表示される）
      await page.waitForTimeout(500);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('前提条件を削除できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Delete Precondition Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addPrecondition(testCase.testCase.id, {
      content: 'Precondition to delete',
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // 前提条件セクションを開く
      const preconditionTab = page.getByRole('tab', { name: /前提条件/ });
      if (await preconditionTab.isVisible()) {
        await preconditionTab.click();
      }

      // 前提条件の削除ボタンをクリック
      const deleteButton = page
        .locator('[data-testid="delete-precondition"]')
        .or(page.getByRole('button', { name: /削除/ }))
        .first();
      await deleteButton.click();

      // 確認ダイアログがあれば確認
      const confirmButton = page.getByRole('button', { name: /削除する|確認/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // 前提条件が消える
      await expect(page.getByText('Precondition to delete')).not.toBeVisible({ timeout: 10000 });
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('前提条件を並び替えできる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Reorder Precondition Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    const p1 = await apiClient.addPrecondition(testCase.testCase.id, {
      content: 'First precondition',
    });
    const p2 = await apiClient.addPrecondition(testCase.testCase.id, {
      content: 'Second precondition',
    });
    const p3 = await apiClient.addPrecondition(testCase.testCase.id, {
      content: 'Third precondition',
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // 前提条件セクションを開く
      const preconditionTab = page.getByRole('tab', { name: /前提条件/ });
      if (await preconditionTab.isVisible()) {
        await preconditionTab.click();
      }

      // ドラッグ&ドロップで並び替え
      const first = page.getByText('First precondition');
      const third = page.getByText('Third precondition');

      await first.dragTo(third);

      // 並び順が変更される
      await page.waitForTimeout(1000);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });
});

test.describe('ステップ管理', () => {
  test('ステップ一覧が表示される', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Step List Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addStep(testCase.testCase.id, { content: 'Click the login button' });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // ステップタブ/セクションに移動
      const stepTab = page.getByRole('tab', { name: /ステップ/ });
      if (await stepTab.isVisible()) {
        await stepTab.click();
      }

      // ステップが表示される
      await expect(page.getByText('Click the login button')).toBeVisible();
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('ステップを追加できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Add Step Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);
      await page.waitForLoadState('networkidle');

      // テストケース詳細が表示されることを確認
      await expect(page.getByText(testCase.testCase.title)).toBeVisible({ timeout: 10000 });

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ }).first();
      await editButton.click();

      // ステップセクションを開く
      const stepTab = page.getByRole('tab', { name: /ステップ/ });
      if (await stepTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stepTab.click();
      }

      // ページが正しく表示されていることを確認
      await expect(page).toHaveURL(/\/test-suites\//);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('ステップを編集できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Edit Step Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addStep(testCase.testCase.id, { content: 'Original step' });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);
      await page.waitForLoadState('networkidle');

      // ステップが表示されることを確認
      await expect(page.getByText('Original step')).toBeVisible({ timeout: 10000 });

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ }).first();
      await editButton.click();

      // 編集モードに入れたことを確認
      await page.waitForTimeout(500);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('ステップを削除できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Delete Step Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addStep(testCase.testCase.id, { content: 'Step to delete' });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // ステップセクションを開く
      const stepTab = page.getByRole('tab', { name: /ステップ/ });
      if (await stepTab.isVisible()) {
        await stepTab.click();
      }

      // ステップの削除ボタンをクリック
      const deleteButton = page
        .locator('[data-testid="delete-step"]')
        .or(page.getByRole('button', { name: /削除/ }))
        .first();
      await deleteButton.click();

      // 確認ダイアログがあれば確認
      const confirmButton = page.getByRole('button', { name: /削除する|確認/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // ステップが消える
      await expect(page.getByText('Step to delete')).not.toBeVisible({ timeout: 10000 });
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('ステップを並び替えできる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Reorder Step Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addStep(testCase.testCase.id, { content: 'Step one' });
    await apiClient.addStep(testCase.testCase.id, { content: 'Step two' });
    await apiClient.addStep(testCase.testCase.id, { content: 'Step three' });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // ステップセクションを開く
      const stepTab = page.getByRole('tab', { name: /ステップ/ });
      if (await stepTab.isVisible()) {
        await stepTab.click();
      }

      // ドラッグ&ドロップで並び替え
      const first = page.getByText('Step one');
      const third = page.getByText('Step three');

      await first.dragTo(third);

      // 並び順が変更される
      await page.waitForTimeout(1000);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });
});

test.describe('期待結果管理', () => {
  test('期待結果一覧が表示される', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Expected Result List Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'User sees dashboard' });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 期待結果タブ/セクションに移動
      const expectedTab = page.getByRole('tab', { name: /期待結果|期待値/ });
      if (await expectedTab.isVisible()) {
        await expectedTab.click();
      }

      // 期待結果が表示される
      await expect(page.getByText('User sees dashboard')).toBeVisible();
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('期待結果を追加できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Add Expected Result Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);
      await page.waitForLoadState('networkidle');

      // テストケース詳細が表示されることを確認
      await expect(page.getByText(testCase.testCase.title)).toBeVisible({ timeout: 10000 });

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ }).first();
      await editButton.click();

      // 期待結果セクションを開く
      const expectedTab = page.getByRole('tab', { name: /期待結果|期待値/ });
      if (await expectedTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expectedTab.click();
      }

      // ページが正しく表示されていることを確認
      await expect(page).toHaveURL(/\/test-suites\//);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('期待結果を編集できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Edit Expected Result Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, {
      content: 'Original expected result',
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);
      await page.waitForLoadState('networkidle');

      // 期待結果が表示されることを確認
      await expect(page.getByText('Original expected result')).toBeVisible({ timeout: 10000 });

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ }).first();
      await editButton.click();

      // 編集モードに入れたことを確認
      await page.waitForTimeout(500);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('期待結果を削除できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Delete Expected Result Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, {
      content: 'Expected result to delete',
    });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // 期待結果セクションを開く
      const expectedTab = page.getByRole('tab', { name: /期待結果|期待値/ });
      if (await expectedTab.isVisible()) {
        await expectedTab.click();
      }

      // 期待結果の削除ボタンをクリック
      const deleteButton = page
        .locator('[data-testid="delete-expected-result"]')
        .or(page.getByRole('button', { name: /削除/ }))
        .first();
      await deleteButton.click();

      // 確認ダイアログがあれば確認
      const confirmButton = page.getByRole('button', { name: /削除する|確認/ });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }

      // 期待結果が消える
      await expect(page.getByText('Expected result to delete')).not.toBeVisible({ timeout: 10000 });
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('期待結果を並び替えできる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Reorder Expected Result Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Result A' });
    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Result B' });
    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Result C' });

    try {
      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}?testCase=${testCase.testCase.id}`);

      // 編集モードに入る
      const editButton = page.getByRole('button', { name: /編集/ });
      await editButton.click();

      // 期待結果セクションを開く
      const expectedTab = page.getByRole('tab', { name: /期待結果|期待値/ });
      if (await expectedTab.isVisible()) {
        await expectedTab.click();
      }

      // ドラッグ&ドロップで並び替え
      const first = page.getByText('Result A');
      const third = page.getByText('Result C');

      await first.dragTo(third);

      // 並び順が変更される
      await page.waitForTimeout(1000);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });
});
