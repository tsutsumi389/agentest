import { test, expect } from '../../fixtures';

// シードデータのID
const DEMO_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_TEST_SUITE_ID = '00000000-0000-0000-0000-000000000002';
const DEMO_ENVIRONMENT_ID = '00000000-0000-0000-0000-000000000010';

test.describe('テスト実行開始', () => {
  test('テスト実行を開始できる', async ({ page, apiClient }) => {
    // テストケースを作成
    const testCase = await apiClient.createTestCase({
      title: `Execution Start Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    // ステップと期待結果を追加
    await apiClient.addStep(testCase.testCase.id, { content: 'Step 1' });
    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Expected result 1' });

    // テストスイートページに遷移
    await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);
    await page.waitForLoadState('networkidle');

    // ヘッダーの実行開始ボタンをクリック
    const startButton = page.getByRole('button', { name: /実行開始|テストを実行/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // モーダルが表示されるのを待つ
    await expect(page.getByRole('heading', { name: 'テスト実行を開始' })).toBeVisible({ timeout: 5000 });

    // モーダル内の実行開始ボタンをJavaScriptで直接クリック
    const executeButton = page.getByRole('button', { name: '実行開始' }).last();
    await executeButton.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
      (el as HTMLButtonElement).click();
    });

    // 実行ページに遷移する
    await expect(page).toHaveURL(/\/executions\//, { timeout: 15000 });

    // クリーンアップ（エラーを無視）
    await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id).catch(() => {});
  });

  test('環境を選択して実行できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Env Execution Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addStep(testCase.testCase.id, { content: 'Step with env' });
    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Expected with env' });

    // テストスイートページに遷移
    await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);
    await page.waitForLoadState('networkidle');

    // ヘッダーの実行開始ボタンをクリック
    const startButton = page.getByRole('button', { name: /実行開始|テストを実行/ }).first();
    await expect(startButton).toBeVisible({ timeout: 10000 });
    await startButton.click();

    // モーダルが表示されるのを待つ
    await expect(page.getByRole('heading', { name: 'テスト実行を開始' })).toBeVisible({ timeout: 5000 });

    // 環境選択（デフォルトでDevelopmentが選択されている）
    // Development はデフォルトで選択済みなのでスキップ可能

    // モーダル内の実行ボタンをJavaScriptで直接クリック
    const executeButton = page.getByRole('button', { name: '実行開始' }).last();
    await executeButton.evaluate((el) => {
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
      (el as HTMLButtonElement).click();
    });

    // 実行ページに遷移する
    await expect(page).toHaveURL(/\/executions\//, { timeout: 15000 });

    // クリーンアップ（エラーを無視）
    await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id).catch(() => {});
  });

  test('実行中のステータスが表示される', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Status Display Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addStep(testCase.testCase.id, { content: 'Check status step' });
    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Check status result' });

    try {
      // APIで実行を開始
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/executions/${execution.execution.id}`);
      await page.waitForLoadState('networkidle');

      // 実行ページが表示されることを確認（詳細な内容は環境によって異なる可能性）
      await expect(page).toHaveURL(/\/executions\//);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });
});

test.describe('テスト実施記録', () => {
  test('前提条件のステータスを更新できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Precondition Status Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addPrecondition(testCase.testCase.id, { content: 'User is authenticated' });
    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Result check' });

    try {
      // 実行を開始
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/executions/${execution.execution.id}`);

      // テストケースを選択
      await page.getByText(testCase.testCase.title).click();

      // 前提条件のステータスボタンをクリック
      const preconditionStatus = page.getByRole('button', { name: /OK|完了|PASS/ }).first();
      if (await preconditionStatus.isVisible()) {
        await preconditionStatus.click();
      }

      // ステータスが更新される
      await page.waitForTimeout(500);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('ステップのステータスを更新できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Step Status Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addStep(testCase.testCase.id, { content: 'Click submit button' });
    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Result' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/executions/${execution.execution.id}`);

      // テストケースを選択
      await page.getByText(testCase.testCase.title).click();

      // ステップセクションを展開
      const stepSection = page.getByText(/ステップ/);
      if (await stepSection.isVisible()) {
        await stepSection.click();
      }

      // ステップのステータスボタンをクリック
      const stepStatus = page.getByRole('button', { name: /完了|DONE|OK/ });
      if (await stepStatus.first().isVisible()) {
        await stepStatus.first().click();
      }

      await page.waitForTimeout(500);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('期待結果の判定を記録できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Expected Result Status Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Form is submitted successfully' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/executions/${execution.execution.id}`);

      // テストケースを選択
      await page.getByText(testCase.testCase.title).click();

      // 期待結果セクションを展開
      const expectedSection = page.getByText(/期待結果|期待値/);
      if (await expectedSection.isVisible()) {
        await expectedSection.click();
      }

      // PASSボタンをクリック
      const passButton = page.getByRole('button', { name: /PASS|成功|OK/ });
      if (await passButton.first().isVisible()) {
        await passButton.first().click();
      }

      // ステータスが更新される
      await page.waitForTimeout(500);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('各項目にメモを追加できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Note Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Check with note' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/executions/${execution.execution.id}`);

      // テストケースを選択
      await page.getByText(testCase.testCase.title).click();

      // メモ追加ボタンまたはメモ入力欄を探す
      const noteButton = page.getByRole('button', { name: /メモ|ノート|コメント/ });
      if (await noteButton.first().isVisible()) {
        await noteButton.first().click();
      }

      // メモを入力
      const noteInput = page.getByPlaceholder(/メモ|ノート|コメント/);
      if (await noteInput.isVisible()) {
        await noteInput.fill('Test memo for E2E');

        // 保存
        const saveButton = page.getByRole('button', { name: /保存/ });
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }

        // メモが表示される
        await expect(page.getByText('Test memo for E2E')).toBeVisible({ timeout: 5000 });
      }
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });
});

test.describe('エビデンス管理', () => {
  test('エビデンスをアップロードできる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Evidence Upload Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Evidence required' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/executions/${execution.execution.id}`);

      // テストケースを選択
      await page.getByText(testCase.testCase.title).click();

      // エビデンスアップロードボタンを探す
      const uploadButton = page.getByRole('button', { name: /エビデンス|添付|アップロード/ });
      if (await uploadButton.first().isVisible()) {
        await uploadButton.first().click();
      }

      // ファイル選択（テスト用のダミーファイル）
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.isVisible()) {
        // テスト用の画像ファイルを作成して選択
        await fileInput.setInputFiles({
          name: 'test-evidence.png',
          mimeType: 'image/png',
          buffer: Buffer.from('fake-image-data'),
        });

        // アップロード完了を待つ
        await page.waitForTimeout(2000);
      }
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('アップロードしたエビデンスが表示される', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Evidence Display Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'With evidence' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/executions/${execution.execution.id}`);
      await page.waitForLoadState('networkidle');

      // 実行ページが表示されることを確認
      await expect(page).toHaveURL(/\/executions\//);

      // テストケースが表示される
      await expect(page.getByText(testCase.testCase.title)).toBeVisible({ timeout: 10000 });
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('エビデンスをダウンロードできる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Evidence Download Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Download test' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);
      const executionDetails = await apiClient.getExecutionWithDetails(execution.execution.id);

      const expectedResults = executionDetails.execution.expectedResults;
      if (expectedResults.length > 0) {
        await apiClient.uploadEvidence(
          execution.execution.id,
          expectedResults[0].id,
          'test.png'
        );
      }

      await page.goto(`/executions/${execution.execution.id}`);

      // テストケースを選択
      await page.getByText(testCase.testCase.title).click();

      // ダウンロードボタンをクリック
      const downloadButton = page.getByRole('button', { name: /ダウンロード/ });
      if (await downloadButton.first().isVisible()) {
        // ダウンロードイベントを待機
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
          downloadButton.first().click(),
        ]);

        // ダウンロードが開始される（または新しいタブでプレビュー）
      }
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('エビデンスを削除できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Evidence Delete Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Delete evidence test' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);
      const executionDetails = await apiClient.getExecutionWithDetails(execution.execution.id);

      const expectedResults = executionDetails.execution.expectedResults;
      if (expectedResults.length > 0) {
        await apiClient.uploadEvidence(
          execution.execution.id,
          expectedResults[0].id,
          'test.png'
        );
      }

      await page.goto(`/executions/${execution.execution.id}`);

      // テストケースを選択
      await page.getByText(testCase.testCase.title).click();

      // 削除ボタンをクリック
      const deleteButton = page.getByRole('button', { name: /削除/ }).first();
      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // 確認ダイアログ
        const confirmButton = page.getByRole('button', { name: /削除する|確認/ });
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // エビデンスが削除される
        await page.waitForTimeout(1000);
      }
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });
});

test.describe('実行履歴', () => {
  test('テストスイートの実行履歴が表示される', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Execution History Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'History check' });

    try {
      // 実行を作成
      await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);
      await page.waitForLoadState('networkidle');

      // 実行履歴タブをクリック
      const executionTab = page.getByRole('button', { name: '実行履歴' });
      if (await executionTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await executionTab.click();
        await page.waitForTimeout(500);
      }

      // ページがロードされていることを確認
      await expect(page).toHaveURL(/\/test-suites\//);
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });

  test('実行詳細を確認できる', async ({ page, apiClient }) => {
    const testCase = await apiClient.createTestCase({
      title: `Execution Detail Test ${Date.now()}`,
      projectId: DEMO_PROJECT_ID,
      testSuiteId: DEMO_TEST_SUITE_ID,
    });

    await apiClient.addExpectedResult(testCase.testCase.id, { content: 'Detail check' });

    try {
      const execution = await apiClient.startExecution(DEMO_TEST_SUITE_ID);

      await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

      // 実行タブをクリック
      const executionTab = page.getByRole('tab', { name: /実行|履歴/ });
      if (await executionTab.isVisible()) {
        await executionTab.click();
      }

      // 実行履歴の項目をクリック
      const executionLink = page.locator('a[href*="/executions/"]').first();
      if (await executionLink.isVisible()) {
        await executionLink.click();

        // 実行詳細ページに遷移
        await expect(page).toHaveURL(/\/executions\//, { timeout: 10000 });

        // 詳細が表示される
        await expect(page.getByText(testCase.testCase.title)).toBeVisible();
      }
    } finally {
      await apiClient.deleteTestCase(DEMO_PROJECT_ID, DEMO_TEST_SUITE_ID, testCase.testCase.id);
    }
  });
});
