# E2Eテスト基盤構築計画

## 概要

Playwright を使ったE2Eテスト基盤を構築する。初期スコープは **Webアプリ（apps/web）のみ**。
OAuth認証のバイパスにはテスト専用ログインエンドポイントを使用する。

## 前提

- 現在E2Eテストは未導入（docs/guides/testing.md に「将来」と記載）
- 274件のユニット/統合テストが Vitest + Supertest で稼働中
- 開発環境は完全Docker（Web:3000, API:3001, WS:3002）
- Playwright はホスト上で実行し、Dockerサービスに対してテストする

---

## Step 1: テスト専用ログインエンドポイントの追加

**目的**: OAuth認証をバイパスしてE2Eテスト用の認証状態を作成する

### 変更ファイル: `apps/api/src/routes/auth.ts`

`NODE_ENV !== 'production'` の場合のみ有効な `POST /api/auth/test-login` を追加する。

```typescript
// テスト用ログインエンドポイント（非本番環境のみ）
if (env.NODE_ENV !== 'production') {
  router.post('/test-login', async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        res.status(400).json({ error: 'メールアドレスが必要です' });
        return;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        res.status(404).json({ error: 'ユーザーが見つかりません' });
        return;
      }

      // 既存のoauthCallbackと同じロジックでトークン生成・クッキー設定
      const tokens = generateTokens(user.id, user.email, authConfig);
      // ... リフレッシュトークン保存、セッション作成、クッキー設定

      res.json({ user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      next(error);
    }
  });
}
```

**参照する既存ロジック**:
- `apps/api/src/controllers/auth.controller.ts` 242-274行: `oauthCallback` のトークン生成・クッキー設定
- `cookieOptions` (26-31行): `httpOnly: true, secure: false(dev), sameSite: 'strict', path: '/'`
- `access_token` クッキー: `maxAge: 15 * 60 * 1000` (15分)
- `refresh_token` クッキー: `maxAge: 7 * 24 * 60 * 60 * 1000` (7日)

**必要なimport追加**:
- `prisma` from `@agentest/db`
- `generateTokens` from `@agentest/auth`

---

## Step 2: E2Eディレクトリ構造の作成とPlaywrightインストール

### ディレクトリ構造

```
e2e/
  playwright.config.ts        # Playwright設定
  package.json                # Playwright依存
  tsconfig.json               # TypeScript設定
  .gitignore                  # test-results, playwright-report除外
  auth/
    web.setup.ts              # 認証セットアップ（storageState生成）
  fixtures/
    index.ts                  # カスタムフィクスチャ（apiClient等）
  helpers/
    api-client.ts             # API直接リクエストヘルパー
  tests/
    web/
      login.spec.ts           # ログインページテスト
      dashboard.spec.ts       # ダッシュボードテスト
      projects.spec.ts        # プロジェクトCRUDテスト
      test-suites.spec.ts     # テストスイートCRUDテスト
```

### `e2e/package.json`

```json
{
  "name": "agentest-e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:web": "playwright test --project=web",
    "test:headed": "playwright test --headed",
    "test:ui": "playwright test --ui",
    "report": "playwright show-report"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.0",
    "@types/node": "^22.0.0"
  }
}
```

### `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'ja-JP',
  },
  projects: [
    // 認証セットアッププロジェクト
    {
      name: 'web-setup',
      testDir: './auth',
      testMatch: 'web.setup.ts',
    },
    // Webアプリテスト（認証済み）
    {
      name: 'web',
      testDir: './tests/web',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.E2E_WEB_URL || 'http://localhost:3000',
        storageState: 'e2e/.auth/web-user.json',
      },
      dependencies: ['web-setup'],
    },
  ],
});
```

---

## Step 3: 認証セットアップの実装

### `e2e/auth/web.setup.ts`

Playwright の `storageState` 機能を使い、テスト用ログインエンドポイントで認証状態を保存する。

```typescript
import { test as setup, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const authFile = 'e2e/.auth/web-user.json';

setup('Webアプリの認証状態を作成', async ({ request }) => {
  const response = await request.post(`${API_URL}/api/auth/test-login`, {
    data: { email: 'demo@agentest.dev' },
  });
  expect(response.ok()).toBeTruthy();
  await request.storageState({ path: authFile });
});
```

**依存するシードデータ** (`packages/db/prisma/seed.ts`):
- `demo@agentest.dev` (PROプラン、Demo Organization のOWNER)
- Demo Project, Demo Test Suite, Demo Test Case が紐づく

---

## Step 4: カスタムフィクスチャとヘルパーの実装

### `e2e/fixtures/index.ts`

```typescript
import { test as base } from '@playwright/test';
import { TestApiClient } from '../helpers/api-client';

type Fixtures = {
  apiClient: TestApiClient;
};

export const test = base.extend<Fixtures>({
  apiClient: async ({ request }, use) => {
    const apiUrl = process.env.E2E_API_URL || 'http://localhost:3001';
    await use(new TestApiClient(request, apiUrl));
  },
});

export { expect } from '@playwright/test';
```

### `e2e/helpers/api-client.ts`

テストデータの作成・削除をAPIで行うヘルパー。`APIRequestContext` を使うため認証クッキーが自動的に含まれる。

主なメソッド:
- `createProject(data)` / `deleteProject(projectId)`
- `createTestSuite(data)` / `deleteTestSuite(testSuiteId)`
- `createTestCase(data)` / `deleteTestCase(testCaseId)`

---

## Step 5: 初期テストケースの実装

### 5-1. ログインページテスト (`e2e/tests/web/login.spec.ts`)

認証なしでアクセスし、ログインページの表示を確認する。

```typescript
import { test, expect } from '@playwright/test';

// ログインページは認証不要 → storageState を上書き
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('ログインページ', () => {
  test('未認証ユーザーにログインページが表示される', async ({ page }) => {
    await page.goto('/login');
    // GitHubログインボタンの存在確認
    await expect(page.getByRole('button', { name: /github/i })).toBeVisible();
  });

  test('未認証で保護ページにアクセスするとログインにリダイレクトされる', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
```

### 5-2. ダッシュボードテスト (`e2e/tests/web/dashboard.spec.ts`)

認証済み状態（storageState自動適用）でダッシュボードの表示を確認。

- ダッシュボードページが表示される
- 「最近のプロジェクト」セクションが見える
- ナビゲーションが機能する

### 5-3. プロジェクトCRUDテスト (`e2e/tests/web/projects.spec.ts`)

- プロジェクト一覧にDemoプロジェクトが表示される
- 新規プロジェクト作成 → 確認 → 削除
- プロジェクト詳細画面への遷移

### 5-4. テストスイートCRUDテスト (`e2e/tests/web/test-suites.spec.ts`)

- テストスイート一覧の表示
- 新規テストスイート作成
- テストケースの追加

---

## Step 6: 設定ファイルの更新

### ルート `.gitignore` に追加

```
# E2E
e2e/.auth/
e2e/test-results/
e2e/playwright-report/
```

### ルート `package.json` にスクリプト追加

```json
"test:e2e": "cd e2e && npx playwright test"
```

### `docs/guides/testing.md` の更新

Playwright の行を「将来」から実際の使用方法に更新する。

---

## 変更対象ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `apps/api/src/routes/auth.ts` | 編集 | テスト用ログインエンドポイント追加 |
| `e2e/package.json` | 新規 | Playwright依存 |
| `e2e/tsconfig.json` | 新規 | TypeScript設定 |
| `e2e/playwright.config.ts` | 新規 | Playwright設定 |
| `e2e/.gitignore` | 新規 | 生成ファイル除外 |
| `e2e/auth/web.setup.ts` | 新規 | 認証セットアップ |
| `e2e/fixtures/index.ts` | 新規 | カスタムフィクスチャ |
| `e2e/helpers/api-client.ts` | 新規 | APIヘルパー |
| `e2e/tests/web/login.spec.ts` | 新規 | ログインページテスト |
| `e2e/tests/web/dashboard.spec.ts` | 新規 | ダッシュボードテスト |
| `e2e/tests/web/projects.spec.ts` | 新規 | プロジェクトCRUDテスト |
| `e2e/tests/web/test-suites.spec.ts` | 新規 | テストスイートCRUDテスト |
| `.gitignore` | 編集 | E2E生成ファイル除外追加 |
| `package.json` | 編集 | `test:e2e` スクリプト追加 |
| `docs/guides/testing.md` | 編集 | E2Eテストのドキュメント更新 |

---

## 検証手順

1. Dockerサービスを起動: `cd docker && docker compose up -d`
2. サービスの正常起動を確認: API, Web のヘルスチェック通過を待つ
3. シードデータ投入: `docker compose exec dev pnpm --filter @agentest/db db:seed`
4. Playwrightインストール: `cd e2e && npm install && npx playwright install chromium`
5. E2Eテスト実行: `npx playwright test`
6. 全テストがパスすることを確認
7. `npx playwright show-report` でHTMLレポートを確認
