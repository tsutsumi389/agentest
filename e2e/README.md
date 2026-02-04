# E2E テスト

Playwright を使用した E2E テスト。ホスト上で実行し、Docker 上のサービスに対してテストする。

## 前提条件

- Node.js 22 以上
- Docker サービスが起動していること（Web:3000, API:3001）
- シードデータが投入済みであること

## セットアップ

```bash
# 依存パッケージのインストール
cd e2e
npm install

# ブラウザのインストール（Chromium）
npx playwright install chromium
```

## Docker サービスの準備

```bash
# サービス起動
cd docker && docker compose up -d

# シードデータ投入（初回のみ）
docker compose exec dev pnpm --filter @agentest/db db:seed
```

## テスト実行

```bash
# 全テスト実行
npm test

# Webアプリテストのみ
npm run test:web

# ブラウザを表示して実行（デバッグ用）
npm run test:headed

# UIモードで実行（インタラクティブデバッグ）
npm run test:ui

# HTMLレポートを表示
npm run report
```

ルートディレクトリからも実行可能:

```bash
pnpm test:e2e
```

## 環境変数

| 変数 | デフォルト | 説明 |
|------|-----------|------|
| `E2E_WEB_URL` | `http://localhost:3000` | Web アプリの URL |
| `E2E_API_URL` | `http://localhost:3001` | API サーバーの URL |
| `CI` | - | CI 環境フラグ（リトライ 2 回、ワーカー 1） |

## ディレクトリ構成

```
e2e/
├── playwright.config.ts    # Playwright 設定
├── auth/
│   └── web.setup.ts        # 認証セットアップ（storageState 生成）
├── fixtures/
│   └── index.ts            # カスタムフィクスチャ（apiClient 等）
├── helpers/
│   └── api-client.ts       # API リクエストヘルパー
└── tests/
    └── web/                # Web アプリテスト
        ├── login.spec.ts       # ログインページ
        ├── dashboard.spec.ts   # ダッシュボード
        ├── projects.spec.ts    # プロジェクト CRUD
        └── test-suites.spec.ts # テストスイート CRUD
```

## 認証の仕組み

OAuth 認証をバイパスするため、テスト専用ログインエンドポイント（`POST /api/auth/test-login`）を使用する。このエンドポイントは `NODE_ENV !== 'production'` の場合のみ有効。

1. `web-setup` プロジェクトが `auth/web.setup.ts` を実行
2. テスト用エンドポイントにリクエストし、認証クッキーを取得
3. 認証状態を `.auth/web-user.json` に保存
4. `web` プロジェクトの各テストが `storageState` として自動的に読み込む

テストユーザー: `demo@agentest.dev`（シードデータで作成済み）

## テストの書き方

### 認証済みテスト

`fixtures/index.ts` からインポートすると `storageState` が自動適用される:

```typescript
import { test, expect } from '../../fixtures';

test('認証済みページが表示される', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('最近のプロジェクト')).toBeVisible();
});
```

### 未認証テスト

`storageState` を空にオーバーライドする:

```typescript
import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

test('ログインページが表示される', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'ログイン' })).toBeVisible();
});
```

### API ヘルパーの使用

`apiClient` フィクスチャでテストデータの作成・削除ができる:

```typescript
import { test, expect } from '../../fixtures';

test('プロジェクトを作成して確認', async ({ page, apiClient }) => {
  const project = await apiClient.createProject({
    name: 'テスト用プロジェクト',
    organizationId: '...',
  });

  // テストデータを使った操作
  await page.goto(`/projects/${project.id}`);

  // クリーンアップ
  await apiClient.deleteProject(project.id);
});
```

## トラブルシューティング

### テストがタイムアウトする

Docker サービスが起動しているか確認:

```bash
curl http://localhost:3000  # Web
curl http://localhost:3001/api/health  # API
```

### 認証セットアップが失敗する

シードデータが投入されているか確認:

```bash
cd docker
docker compose exec dev pnpm --filter @agentest/db db:seed
```

### ブラウザが見つからない

Playwright のブラウザを再インストール:

```bash
npx playwright install chromium
```
