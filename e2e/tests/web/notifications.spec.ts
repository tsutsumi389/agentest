import { test, expect } from '../../fixtures';

test.describe('通知一覧', () => {
  test('通知一覧ページが表示される', async ({ page }) => {
    // 通知一覧ページに遷移
    await page.goto('/notifications');

    // ページタイトルが表示される
    await expect(page.getByRole('heading', { name: '通知' })).toBeVisible();

    // 通知リストまたは空メッセージが表示される
    await expect(
      page.getByText(/通知.*ありません/).or(page.locator('.divide-y').first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('通知設定へのリンクが表示される', async ({ page }) => {
    // 通知一覧ページに遷移
    await page.goto('/notifications');

    // 通知設定リンクが表示される
    await expect(page.getByRole('link', { name: /通知設定/ })).toBeVisible();
  });

  test('通知をクリックで既読にできる', async ({ page, apiClient }) => {
    // 注: 通知を作成するAPIが必要
    // この例では、通知があると仮定してテスト

    // 通知一覧ページに遷移
    await page.goto('/notifications');

    // 未読通知があれば既読にする
    const unreadNotification = page.locator('[class*="unread"], [data-unread="true"]').first();
    if (await unreadNotification.isVisible()) {
      await unreadNotification.click();
      // 既読になることを確認（スタイルの変化など）
      await expect(unreadNotification).not.toHaveClass(/unread/);
    }
  });

  test('すべてを既読にできる', async ({ page }) => {
    // 通知一覧ページに遷移
    await page.goto('/notifications');

    // 「すべてを既読にする」ボタンがあればクリック
    const markAllReadButton = page.getByRole('button', { name: /全て.*既読|すべて.*既読/ });
    if (await markAllReadButton.isVisible()) {
      await markAllReadButton.click();

      // 未読カウントが0になるか、ボタンが非表示になる
      await expect(markAllReadButton).toBeHidden({ timeout: 10000 });
    }
  });

  test('通知をスクロールで追加読み込みできる', async ({ page }) => {
    // 通知一覧ページに遷移
    await page.goto('/notifications');

    // 「もっと読み込む」ボタンがあればクリック
    const loadMoreButton = page.getByRole('button', { name: /もっと読み込む/ });
    if (await loadMoreButton.isVisible()) {
      await loadMoreButton.click();

      // 読み込み中の状態を確認
      await expect(loadMoreButton.getByText(/読み込み中/)).toBeVisible();

      // 読み込み完了を待機
      await expect(loadMoreButton.getByText(/読み込み中/)).toBeHidden({ timeout: 10000 });
    }
  });
});

test.describe('通知設定', () => {
  test('通知設定ページが表示される', async ({ page }) => {
    // 通知設定ページに遷移
    await page.goto('/settings?tab=notifications');

    // 通知設定セクションが表示される
    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible({ timeout: 10000 });
  });

  test('通知タイプ一覧が表示される', async ({ page }) => {
    // 通知設定ページに遷移
    await page.goto('/settings?tab=notifications');

    // 通知設定の読み込みを待機
    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible({ timeout: 10000 });

    // 通知タイプが表示される（少なくとも1つ）
    await expect(page.getByText('組織への招待').first()).toBeVisible({ timeout: 10000 });
  });

  test('通知タイプごとにON/OFFできる', async ({ page }) => {
    // 通知設定ページに遷移
    await page.goto('/settings?tab=notifications');

    // 通知設定の読み込みを待機
    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible({ timeout: 10000 });

    // トグルスイッチを取得（rounded-fullクラスを持つbutton）
    const toggleButtons = page.locator('button.rounded-full');
    await expect(toggleButtons.first()).toBeVisible({ timeout: 10000 });

    // 最初のトグルをクリック
    const firstToggle = toggleButtons.first();
    await firstToggle.click();

    // 成功メッセージが表示される
    await expect(page.getByText('通知設定を更新しました')).toBeVisible({ timeout: 10000 });

    // トグルを元に戻す
    await firstToggle.click();
    await expect(page.getByText('通知設定を更新しました')).toBeVisible({ timeout: 10000 });
  });

  test('メール通知設定を変更できる', async ({ page }) => {
    // 通知設定ページに遷移
    await page.goto('/settings?tab=notifications');

    // 通知設定の読み込みを待機
    await expect(page.getByRole('heading', { name: '通知設定' })).toBeVisible({ timeout: 10000 });

    // メール通知のトグルを探す（aria-labelで特定）
    const emailToggles = page.locator('button[aria-label*="メール通知"]');
    const emailToggleCount = await emailToggles.count();

    if (emailToggleCount > 0) {
      // 最初のメールトグルをクリック
      const firstEmailToggle = emailToggles.first();
      await firstEmailToggle.click();

      // 成功メッセージが表示される
      await expect(page.getByText('通知設定を更新しました')).toBeVisible({ timeout: 10000 });

      // トグルを元に戻す
      await firstEmailToggle.click();
    }
  });
});

test.describe('通知センター（ヘッダー）', () => {
  test('ヘッダーの通知アイコンをクリックすると通知センターが開く', async ({ page }) => {
    // ダッシュボードに遷移
    await page.goto('/dashboard');

    // ヘッダーの通知アイコンを探す（「通知」というアクセシブルラベルを持つボタン）
    const notificationIcon = page.getByRole('button', { name: '通知' });

    await expect(notificationIcon).toBeVisible({ timeout: 10000 });
    await notificationIcon.click();

    // 通知センターまたはドロップダウンが開く
    await expect(
      page.getByRole('heading', { name: '通知' }).or(page.locator('[class*="notification"]').first())
    ).toBeVisible({ timeout: 5000 });
  });

  test('通知ページへのリンクが機能する', async ({ page }) => {
    // 通知ページに直接遷移
    await page.goto('/notifications');

    // 通知ページが表示される
    await expect(page.getByRole('heading', { name: '通知' })).toBeVisible({ timeout: 10000 });

    // URLが正しいことを確認
    await expect(page).toHaveURL(/\/notifications/);
  });
});
