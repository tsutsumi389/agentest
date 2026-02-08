import { test, expect } from '../../fixtures';

// シードデータのDemo Projectは「Demo Organization」に属している
const DEMO_ORG_NAME = 'Demo Organization';

/**
 * 組織フィルターを選択するヘルパー
 */
async function selectOrganizationFilter(page: import('@playwright/test').Page, orgName: string) {
  const filterSelect = page.locator('select').filter({ hasText: '個人プロジェクト' });
  await filterSelect.selectOption({ label: orgName });
}

test.describe('プロジェクト一覧', () => {
  test('プロジェクト一覧ページが表示される', async ({ page }) => {
    await page.goto('/projects');

    // ページ見出しの確認
    await expect(page.getByRole('heading', { name: 'プロジェクト' })).toBeVisible();

    // 「新規プロジェクト」ボタンが表示される
    await expect(page.getByRole('button', { name: '新規プロジェクト' })).toBeVisible();
  });

  test('Demoプロジェクトが一覧に表示される', async ({ page }) => {
    await page.goto('/projects');

    // Demo ProjectはDemo Organizationに属しているため、組織フィルターを変更
    await selectOrganizationFilter(page, DEMO_ORG_NAME);

    // シードデータの Demo Project が表示される（h3要素を指定）
    await expect(page.getByRole('heading', { name: 'Demo Project' })).toBeVisible({ timeout: 10000 });
  });

  test('プロジェクトを検索できる', async ({ page }) => {
    await page.goto('/projects');

    // Demo Organizationのプロジェクトを表示
    await selectOrganizationFilter(page, DEMO_ORG_NAME);

    // Demo Projectが表示されるのを待つ
    await expect(page.getByRole('heading', { name: 'Demo Project' })).toBeVisible({ timeout: 10000 });

    // 検索フィールドに入力
    await page.getByPlaceholder('プロジェクトを検索...').fill('Demo');

    // 検索結果に Demo Project が表示される
    await expect(page.getByRole('heading', { name: 'Demo Project' })).toBeVisible();
  });

  test('プロジェクト詳細画面に遷移できる', async ({ page }) => {
    await page.goto('/projects');

    // Demo Organizationのプロジェクトを表示
    await selectOrganizationFilter(page, DEMO_ORG_NAME);

    // Demo Projectが表示されるのを待つ
    await expect(page.getByRole('heading', { name: 'Demo Project' })).toBeVisible({ timeout: 10000 });

    // Demo Project をクリック（h3要素）
    await page.getByRole('heading', { name: 'Demo Project' }).click();

    // プロジェクト詳細ページに遷移
    await expect(page).toHaveURL(/\/projects\/.+/);
  });
});

test.describe('プロジェクトCRUD', () => {
  test('新規プロジェクトを作成して削除できる', async ({ page }) => {
    const projectName = `E2E Test Project ${Date.now()}`;

    // プロジェクト一覧に遷移
    await page.goto('/projects');

    // 「新規プロジェクト」ボタンをクリック
    await page.getByRole('button', { name: '新規プロジェクト' }).click();

    // モーダルが表示される
    await expect(page.getByPlaceholder('例: Webアプリテスト')).toBeVisible();

    // プロジェクト名を入力
    await page.getByPlaceholder('例: Webアプリテスト').fill(projectName);

    // 説明を入力
    await page.getByPlaceholder('プロジェクトの説明を入力...').fill('E2Eテストで作成したプロジェクト');

    // 「作成」ボタンをクリック
    await page.getByRole('button', { name: '作成', exact: true }).click();

    // プロジェクトが作成され、一覧に表示される
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible({ timeout: 10000 });

    // 作成したプロジェクトの詳細に遷移
    await page.getByRole('heading', { name: projectName }).click();
    await expect(page).toHaveURL(/\/projects\/.+/);

    // 設定タブに移動
    await page.getByText('設定').click();

    // サイドバーの「危険な操作」をクリック
    await page.getByText('危険な操作').click();

    // 「プロジェクトを削除」ボタンをクリック
    await page.getByRole('button', { name: 'プロジェクトを削除' }).click();

    // 確認ダイアログで「削除する」をクリック
    await page.getByRole('button', { name: '削除する' }).click();

    // プロジェクト一覧に戻る
    await expect(page).toHaveURL(/\/projects/, { timeout: 10000 });
  });
});
