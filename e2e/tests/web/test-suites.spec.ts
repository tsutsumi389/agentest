import { test, expect } from '../../fixtures';

// シードデータのプロジェクトIDとテストスイートID
const DEMO_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
const DEMO_TEST_SUITE_ID = '00000000-0000-0000-0000-000000000002';

test.describe('テストスイート一覧', () => {
  test('プロジェクト詳細でテストスイートが表示される', async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}`);

    // 「テストスイート」タブをクリック
    await page.getByText('テストスイート').first().click();

    // シードデータのテストスイートが表示される
    await expect(page.getByText('Login Feature Tests')).toBeVisible();
  });

  test('テストスイート詳細に遷移できる', async ({ page }) => {
    await page.goto(`/projects/${DEMO_PROJECT_ID}`);

    // 「テストスイート」タブをクリック
    await page.getByText('テストスイート').first().click();

    // テストスイートをクリック
    await page.getByText('Login Feature Tests').click();

    // テストスイート詳細ページに遷移
    await expect(page).toHaveURL(/\/test-suites\/.+/);
    await expect(page.getByText('Login Feature Tests')).toBeVisible();
  });
});

test.describe('テストスイートCRUD', () => {
  test('新規テストスイートを作成できる', async ({ page }) => {
    const suiteName = `E2E Test Suite ${Date.now()}`;

    // プロジェクト詳細に遷移
    await page.goto(`/projects/${DEMO_PROJECT_ID}`);

    // 「テストスイート」タブをクリック
    await page.getByText('テストスイート').first().click();

    // 「テストスイートを作成」ボタンをクリック（btn-primaryクラスで絞り込み）
    await page.locator('button.btn-primary', { hasText: 'テストスイート' }).click();

    // フォームが表示される
    await expect(page.getByPlaceholder('テストスイートの名前')).toBeVisible();

    // テストスイート名を入力
    await page.getByPlaceholder('テストスイートの名前').fill(suiteName);

    // 説明を入力
    await page.getByPlaceholder(/テストスイートの説明/).fill('E2Eテストで作成したスイート');

    // 「作成」ボタンをクリック
    await page.getByRole('button', { name: '作成', exact: true }).click();

    // テストスイートが作成される（詳細ページへ遷移またはリストに表示）
    await expect(page.getByText(suiteName)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('テストケース', () => {
  test('テストスイート内のテストケースが表示される', async ({ page }) => {
    await page.goto(`/test-suites/${DEMO_TEST_SUITE_ID}`);

    // シードデータのテストケースが表示される
    await expect(page.getByText('Valid user can login successfully')).toBeVisible();
  });
});
