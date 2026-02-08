# API側レートリミッティングの全削除

## Context

現在のレートリミット(`express-rate-limit`)はインメモリストアで実装されており、Cloud Run複数インスタンス環境では各インスタンスが独立してカウントするため実質的に機能しない。本番ではCloud Load Balancer + Cloud Armorでインフラ層のレート制限を行うため、API側のレートリミットは不要。

この変更により以下が改善される:
- Redis依存の追加が不要になる（H-4計画の廃止）
- E2Eテストの`X-E2E-Test`ヘッダーによるバイパスロジックが不要になり、テストコードが大幅に簡素化
- `express-rate-limit`パッケージへの依存を削除

## 変更対象

### 1. ミドルウェア削除

- **削除**: `apps/api/src/middleware/rate-limiter.ts`
- **削除**: `apps/api/src/__tests__/unit/rate-limiter.middleware.test.ts`

### 2. app.ts からレートリミッタ除去

**`apps/api/src/app.ts`**:
- 行11: `import { apiLimiter, authLimiter }` 削除
- 行171-172: `app.use('/api', apiLimiter)` と `app.use('/api/auth', authLimiter)` 削除

### 3. ルートファイルからの除去

**`apps/api/src/routes/users.ts`**:
- `billingLimiter` のimport削除
- `billingMiddleware` 定義から `billingLimiter` を除去 → `[requireAuth(authConfig), requireOwnership()]` に変更

**`apps/api/src/routes/billing.ts`**:
- `billingLimiter` のimport削除、ミドルウェア配列から除去

**`apps/api/src/routes/organizations.ts`**:
- `billingLimiter` のimport削除、全9箇所のミドルウェア配列から除去

**`apps/api/src/routes/oauth.ts`**:
- `authLimiter` のimport削除、2箇所(`/register`, `/token`)から除去

**`apps/api/src/routes/admin/auth.ts`**:
- `adminAuthLimiter` のimport削除、5箇所(`/login`, `/2fa/*`)から除去

### 4. パッケージ依存削除

**`apps/api/package.json`**:
- `"express-rate-limit": "catalog:"` 削除

### 5. E2Eテスト簡素化

**`e2e/fixtures/index.ts`**:
- `E2E_HEADERS`定数削除
- API URLリライトの`page.route`は維持（`API_URL` → `WEB_URL`への書き換えはクッキー送信のために必要）
- `WEB_URL/api/**`の2つ目の`page.route`を削除（E2Eヘッダー追加のみが目的だったため）
- ヘッダースプレッドを除去

**`e2e/helpers/api-client.ts`**:
- `E2E_HEADERS`定数削除
- 全メソッド（約60箇所）から `headers: E2E_HEADERS` を削除

**`e2e/auth/web.setup.ts`**:
- `page.route()`によるE2Eヘッダー追加を削除
- `fetch`の`headers`から`X-E2E-Test`を削除

### 6. ドキュメント更新

- **削除**: `docs/api/rate-limits.md`
- **更新**: `docs/README.md` - レート制限ドキュメントへのリンク削除
- **更新**: `docs/plans/production-readiness.md` - H-4セクションを「対応不要（インフラ層で対応）」に変更

## 検証

1. `docker compose exec dev pnpm build` - ビルド成功の確認
2. `docker compose exec dev pnpm test` - ユニット/統合テスト全通過
3. `pnpm test:e2e` - E2Eテスト全通過（X-E2E-Testヘッダーなしで動作確認）
