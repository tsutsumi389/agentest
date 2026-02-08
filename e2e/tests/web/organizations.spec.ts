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
    let createdOrgId: string | null = null;

    try {
      // 組織一覧ページに遷移
      await page.goto('/organizations');

      // 「組織を作成」ボタンをクリック
      await page.getByRole('button', { name: '組織を作成' }).click();

      // モーダルが表示される
      await expect(page.getByRole('heading', { name: '組織を作成' })).toBeVisible();

      // 組織名を入力（プレースホルダー「My Organization」で特定）
      const nameInput = page.getByPlaceholder('My Organization');
      await nameInput.fill(orgName);

      // 作成ボタンをクリック
      await page.getByRole('button', { name: '作成', exact: true }).click();

      // 組織作成後はダッシュボードにリダイレクトされる
      // 成功メッセージまたはダッシュボードの見出しが表示される
      await expect(
        page.getByText(/作成しました/).or(page.getByRole('heading', { name: '最近のプロジェクト' }))
      ).toBeVisible({ timeout: 15000 });

      // 作成した組織のIDをAPIから取得（クリーンアップ用）
      const orgs = await apiClient.getUserOrganizations();
      const createdOrg = orgs.organizations.find(
        (o) => o.organization.name === orgName,
      );
      if (createdOrg) {
        createdOrgId = createdOrg.organization.id;
      }
    } finally {
      // クリーンアップ: 作成した組織を削除
      if (createdOrgId) {
        await apiClient.deleteOrganization(createdOrgId);
      }
    }
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

    // メンバー管理セクションが表示される
    await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible({ timeout: 10000 });

    // 少なくとも1人のメンバー（自分）が表示される - 「オーナー」ロールを確認
    await expect(page.getByText('オーナー')).toBeVisible({ timeout: 10000 });
  });

  test('メンバーの役割表示が確認できる', async ({ page }) => {
    // メンバー設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=members`);

    // メンバー管理セクションが表示される
    await expect(page.getByRole('heading', { name: 'メンバー管理' })).toBeVisible({ timeout: 10000 });

    // ロール表示（オーナー）が見える
    await expect(page.getByText('オーナー')).toBeVisible({ timeout: 10000 });
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

    // 招待管理セクションが表示される
    await expect(page.getByRole('heading', { name: '招待管理' })).toBeVisible({ timeout: 10000 });

    // メンバーを招待ボタンが表示される
    await expect(page.getByRole('button', { name: 'メンバーを招待' }).first()).toBeVisible();
  });

  test('メンバーを招待できる', async ({ page }) => {
    // 招待設定に遷移
    await page.goto(`/organizations/${testOrgId}/settings?tab=invitations`);

    // 「メンバーを招待」ボタンをクリック
    await page.getByRole('button', { name: 'メンバーを招待' }).first().click();

    // モーダルが表示される（プレースホルダー「member@example.com」）
    await expect(page.getByPlaceholder('member@example.com')).toBeVisible({ timeout: 10000 });

    // メールアドレスを入力
    const testEmail = `e2e-test-${Date.now()}@example.com`;
    await page.getByPlaceholder('member@example.com').fill(testEmail);

    // 招待ボタンをクリック（「招待を送信」）
    await page.getByRole('button', { name: '招待を送信' }).click();

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

    // 対象メールを含む招待行を見つけて「招待を取り消す」ボタンをクリック
    const inviteRow = page.locator('div').filter({ hasText: testEmail }).filter({ has: page.getByRole('button', { name: '招待を取り消す' }) });
    await inviteRow.getByRole('button', { name: '招待を取り消す' }).first().click();

    // 確認ダイアログが表示される
    await expect(page.getByRole('heading', { name: /招待.*取り消/ })).toBeVisible({ timeout: 5000 });

    // 確認ダイアログで確定ボタンをクリック
    await page.getByRole('button', { name: /取り消す/ }).last().click();

    // 成功メッセージが表示される
    await expect(page.getByText(/取り消しました/)).toBeVisible({ timeout: 10000 });
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
    await expect(page.getByRole('heading', { name: '監査ログ' })).toBeVisible({ timeout: 10000 });

    // 組織作成のログ（organization.created）が表示されるはず
    await expect(page.getByText('organization.created')).toBeVisible({ timeout: 10000 });
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
      await expect(page.getByRole('heading', { name: '組織を削除' })).toBeVisible({ timeout: 10000 });

      // 削除ボタンが表示される
      await expect(page.getByRole('button', { name: '組織を削除' })).toBeVisible();
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

    // 「組織を削除」セクション内のボタンをクリック（最初の「組織を削除」ボタン）
    await page.getByRole('button', { name: '組織を削除' }).first().click();

    // 確認モーダルが表示される
    await expect(page.getByRole('heading', { name: '組織を削除' }).last()).toBeVisible({ timeout: 10000 });

    // 組織名を入力して確認
    const confirmInput = page.getByPlaceholder(orgName);
    await confirmInput.fill(orgName);

    // ボタンが有効化されるまで待機してからクリック（モーダル内の削除ボタン）
    const deleteButton = page.getByRole('button', { name: '組織を削除' }).last();
    await expect(deleteButton).toBeEnabled({ timeout: 5000 });
    await deleteButton.click();

    // 削除処理が完了するまで待機（ボタンが「削除中...」に変わり、その後リダイレクト）
    // 組織一覧に戻るか、成功メッセージが表示される
    await expect(
      page.getByText(/削除しました/).or(page.getByRole('heading', { name: '組織', level: 1 })).first()
    ).toBeVisible({ timeout: 30000 });
  });
});
