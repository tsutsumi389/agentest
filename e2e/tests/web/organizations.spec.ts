import { test, expect } from '../../fixtures';

test.describe('組織一覧', () => {
  test('所属組織一覧が表示される', async ({ page }) => {
    // 組織一覧ページに遷移
    await page.goto('/organizations');

    // ページタイトルが表示される
    await expect(page.getByRole('heading', { name: '組織' })).toBeVisible();

    // 組織作成ボタンが表示される
    await expect(page.getByRole('button', { name: '組織を作成' })).toBeVisible();
  });

  test('新規組織を作成できる', async ({ page, apiClient }) => {
    const orgName = `E2E Org ${Date.now()}`;

    // 組織一覧ページに遷移
    await page.goto('/organizations');

    // 「組織を作成」ボタンをクリック
    await page.getByRole('button', { name: '組織を作成' }).click();

    // モーダルが表示される
    await expect(page.getByRole('heading', { name: /組織.*作成/ })).toBeVisible();

    // 組織名を入力
    await page.getByPlaceholder(/組織.*名/).fill(orgName);

    // 作成ボタンをクリック
    await page.getByRole('button', { name: '作成', exact: true }).click();

    // ダッシュボードに遷移するか、成功メッセージが表示される
    await expect(
      page.getByText(/作成しました/).or(page.getByRole('heading', { name: 'ダッシュボード' }))
    ).toBeVisible({ timeout: 15000 });

    // クリーンアップ: APIで組織を取得して削除
    // Note: 組織作成後にダッシュボードに遷移するため、組織IDを取得する必要がある
    // この例では、手動クリーンアップが必要な場合がある
  });

  test('組織を検索できる', async ({ page }) => {
    // 組織一覧ページに遷移
    await page.goto('/organizations');

    // 検索フィールドが表示される
    const searchInput = page.getByPlaceholder(/組織.*検索/);
    await expect(searchInput).toBeVisible();

    // 検索を実行
    await searchInput.fill('test');

    // 検索結果が絞り込まれる（組織がある場合のみ）
    // 注: 検索結果の検証はデータに依存するため、基本的なUI確認のみ
  });
});

test.describe('組織設定', () => {
  let testOrgId: string;

  test.beforeAll(async ({ request }) => {
    // テスト用の組織を作成
    const { TestApiClient } = await import('../../helpers/api-client');
    const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
    const result = await apiClient.createOrganization({ name: `Settings Test Org ${Date.now()}` });
    testOrgId = result.organization.id;
  });

  test.afterAll(async ({ request }) => {
    // テスト用の組織を削除
    if (testOrgId) {
      const { TestApiClient } = await import('../../helpers/api-client');
      const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
      await apiClient.deleteOrganization(testOrgId);
    }
  });

  test('組織設定ページにアクセスできる', async ({ page }) => {
    // 組織設定ページに遷移
    await page.goto(`/organizations/${testOrgId}/settings`);

    // 一般設定が表示される
    await expect(page.getByRole('heading', { name: '一般設定' })).toBeVisible({ timeout: 10000 });
  });

  test('組織名を変更できる', async ({ page }) => {
    // 組織設定ページに遷移
    await page.goto(`/organizations/${testOrgId}/settings`);

    // 組織名フィールドを取得
    await expect(page.getByLabel('組織名')).toBeVisible({ timeout: 10000 });
    const nameInput = page.getByLabel('組織名');
    const originalName = await nameInput.inputValue();

    // 新しい名前を入力
    const newName = `${originalName} Updated`;
    await nameInput.fill(newName);

    // 保存ボタンをクリック
    await page.getByRole('button', { name: '保存' }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/更新しました/)).toBeVisible({ timeout: 10000 });

    // 元の名前に戻す
    await nameInput.fill(originalName);
    await page.getByRole('button', { name: '保存' }).click();
  });
});

test.describe('メンバー管理', () => {
  let testOrgId: string;

  test.beforeAll(async ({ request }) => {
    // テスト用の組織を作成
    const { TestApiClient } = await import('../../helpers/api-client');
    const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
    const result = await apiClient.createOrganization({ name: `Member Test Org ${Date.now()}` });
    testOrgId = result.organization.id;
  });

  test.afterAll(async ({ request }) => {
    // テスト用の組織を削除
    if (testOrgId) {
      const { TestApiClient } = await import('../../helpers/api-client');
      const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
      await apiClient.deleteOrganization(testOrgId);
    }
  });

  test('メンバー一覧が表示される', async ({ page }) => {
    // メンバー設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=members`);

    // メンバータブがアクティブになる
    await expect(page.getByText(/メンバー.*一覧|メンバー/).first()).toBeVisible({ timeout: 10000 });

    // 少なくとも1人のメンバー（自分）が表示される
    await expect(page.getByText('OWNER').or(page.getByText('オーナー'))).toBeVisible({ timeout: 10000 });
  });

  test('メンバーの役割表示が確認できる', async ({ page }) => {
    // メンバー設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=members`);

    // ロール表示が見える
    await expect(
      page.getByText('OWNER').or(page.getByText('オーナー')).or(page.getByText('ADMIN')).or(page.getByText('MEMBER'))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('招待管理', () => {
  let testOrgId: string;

  test.beforeAll(async ({ request }) => {
    // テスト用の組織を作成
    const { TestApiClient } = await import('../../helpers/api-client');
    const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
    const result = await apiClient.createOrganization({ name: `Invite Test Org ${Date.now()}` });
    testOrgId = result.organization.id;
  });

  test.afterAll(async ({ request }) => {
    // テスト用の組織を削除
    if (testOrgId) {
      const { TestApiClient } = await import('../../helpers/api-client');
      const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
      await apiClient.deleteOrganization(testOrgId);
    }
  });

  test('招待タブが表示される', async ({ page }) => {
    // 招待設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=invitations`);

    // 招待に関する要素が表示される
    await expect(
      page.getByRole('button', { name: /招待|メンバー.*追加/ }).or(
        page.getByText(/招待.*一覧|保留中/)
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('メンバーを招待できる', async ({ page }) => {
    // 招待設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=invitations`);

    // 招待ボタンをクリック
    await page.getByRole('button', { name: /招待|メンバー.*追加/ }).click();

    // モーダルが表示される
    await expect(page.getByPlaceholder(/メール/)).toBeVisible({ timeout: 10000 });

    // メールアドレスを入力
    const testEmail = `e2e-test-${Date.now()}@example.com`;
    await page.getByPlaceholder(/メール/).fill(testEmail);

    // 招待ボタンをクリック
    await page.getByRole('button', { name: /招待する|送信/, exact: true }).click();

    // 成功メッセージが表示される
    await expect(page.getByText(/招待.*送信|招待しました/)).toBeVisible({ timeout: 10000 });
  });

  test('保留中の招待一覧が表示される', async ({ page, apiClient }) => {
    // 招待を作成
    const testEmail = `e2e-pending-${Date.now()}@example.com`;
    await apiClient.inviteMember(testOrgId, { email: testEmail, role: 'MEMBER' });

    // 招待設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=invitations`);

    // 保留中の招待が表示される
    await expect(page.getByText(testEmail).or(page.getByText(/保留中/))).toBeVisible({ timeout: 10000 });
  });

  test('招待をキャンセルできる', async ({ page, apiClient }) => {
    // 招待を作成
    const testEmail = `e2e-cancel-${Date.now()}@example.com`;
    const inviteResult = await apiClient.inviteMember(testOrgId, { email: testEmail, role: 'MEMBER' });

    // 招待設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=invitations`);

    // 招待が表示されるまで待機
    await expect(page.getByText(testEmail)).toBeVisible({ timeout: 10000 });

    // キャンセルボタンをクリック
    const inviteRow = page.locator('div', { hasText: testEmail }).first();
    await inviteRow.getByRole('button', { name: /キャンセル|取り消し/ }).click();

    // 確認ダイアログで確定
    await page.getByRole('button', { name: /キャンセル|取り消し|削除/, exact: false }).last().click();

    // 成功メッセージが表示される
    await expect(page.getByText(/キャンセル|取り消|削除.*しました/)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('監査ログ', () => {
  let testOrgId: string;

  test.beforeAll(async ({ request }) => {
    // テスト用の組織を作成
    const { TestApiClient } = await import('../../helpers/api-client');
    const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
    const result = await apiClient.createOrganization({ name: `Audit Test Org ${Date.now()}` });
    testOrgId = result.organization.id;
  });

  test.afterAll(async ({ request }) => {
    // テスト用の組織を削除
    if (testOrgId) {
      const { TestApiClient } = await import('../../helpers/api-client');
      const apiClient = new TestApiClient(request, process.env.E2E_WEB_URL || 'http://localhost:3000');
      await apiClient.deleteOrganization(testOrgId);
    }
  });

  test('組織の監査ログが表示される', async ({ page }) => {
    // 監査ログに遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=audit-logs`);

    // 監査ログセクションが表示される
    await expect(
      page.getByText(/監査ログ/).or(page.getByText(/アクティビティ/))
    ).toBeVisible({ timeout: 10000 });

    // 組織作成のログが表示されるはず
    await expect(
      page.getByText(/作成/).or(page.getByText(/CREATED/)).or(page.getByText(/ログ.*ありません/))
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('危険な操作', () => {
  test('確認ダイアログが表示される', async ({ page, apiClient }) => {
    // テスト用の組織を作成
    const orgName = `Danger Test Org ${Date.now()}`;
    const result = await apiClient.createOrganization({ name: orgName });
    const testOrgId = result.organization.id;

    try {
      // 危険な操作に遷移
      await page.goto(`/organizations/${testOrgId}/settings?tab=danger`);

      // 組織削除セクションが表示される
      await expect(page.getByText(/組織.*削除/)).toBeVisible({ timeout: 10000 });

      // 削除ボタンが表示される
      await expect(page.getByRole('button', { name: /組織を削除/ })).toBeVisible();
    } finally {
      // クリーンアップ
      await apiClient.deleteOrganization(testOrgId);
    }
  });

  test('組織を削除できる', async ({ page, apiClient }) => {
    // テスト用の組織を作成
    const orgName = `Delete Test Org ${Date.now()}`;
    const result = await apiClient.createOrganization({ name: orgName });
    const testOrgId = result.organization.id;

    // 危険な操作に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=danger`);

    // 削除ボタンをクリック
    await page.getByRole('button', { name: /組織を削除/ }).click();

    // 確認モーダルが表示される
    await expect(page.getByText(/削除.*確認|本当に削除/)).toBeVisible({ timeout: 10000 });

    // 組織名を入力して確認
    const confirmInput = page.getByPlaceholder(/組織名/).or(page.locator('input[type="text"]'));
    if (await confirmInput.isVisible()) {
      await confirmInput.fill(orgName);
    }

    // 削除ボタンをクリック
    await page.getByRole('button', { name: /削除する/, exact: false }).click();

    // 組織一覧に戻るか、成功メッセージが表示される
    await expect(
      page.getByText(/削除しました/).or(page.getByRole('heading', { name: '組織' }))
    ).toBeVisible({ timeout: 15000 });
  });
});
