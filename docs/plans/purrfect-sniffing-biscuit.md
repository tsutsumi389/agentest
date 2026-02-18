# 環境変数での機能トグル（OAuth プロバイダー）

## Context

OSS移行プラン（提案C）の一環として、OAuth（GitHub/Google）認証を環境変数で有効/無効に制御する機能を実装する。

**現状の問題:**
- バックエンド側は既に環境変数ベースで動作する（`GITHUB_CLIENT_ID` 等が未設定ならルート未登録）
- フロントエンド側はOAuthボタンを**常に表示**しており、バックエンド未設定時にクリックすると404エラーになる
- フロントに「どのプロバイダーが利用可能か」を伝えるAPIがない

**目的:** 環境変数を設定しなければOAuthが無効になり、UIからもボタンが消える。設定すれば自動的に有効になる。

---

## 実装

### Step 1: 公開設定API追加（API）

`GET /api/config`（認証不要）を新設し、フロントエンドに公開設定を返す。

**ファイル:** `apps/api/src/routes/config.ts`（新規）

```typescript
// GET /api/config
// レスポンス:
{
  auth: {
    providers: {
      github: boolean,  // GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET が設定されているか
      google: boolean,  // GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET が設定されているか
    },
    requireEmailVerification: boolean,
  }
}
```

- `apps/api/src/config/env.ts` の `env` を参照して判定
- `apps/api/src/routes/index.ts` にルートを追加: `router.use('/api/config', configRoutes)`

### Step 2: フロントエンド設定取得（Web）

**ファイル:** `apps/web/src/lib/api.ts` にconfigApi追加

```typescript
export const configApi = {
  get: () => fetchApi<AppConfig>('/api/config'),
};
```

**ファイル:** `apps/web/src/stores/config.ts`（新規） — Zustand storeで設定をキャッシュ

```typescript
// AppConfig型と useConfigStore を定義
// アプリ初期化時に1回fetchし、以降はキャッシュから参照
```

**ファイル:** `apps/web/src/App.tsx` — アプリ起動時に設定をfetch

### Step 3: Login/Register ページ更新（Web）

**ファイル:** `apps/web/src/pages/Login.tsx`
- `useConfigStore` からプロバイダー情報を取得
- GitHub/Google いずれも無効ならOAuthボタンセクション全体（「または」区切り含む）を非表示
- 個別に無効なプロバイダーのボタンのみ非表示

**ファイル:** `apps/web/src/pages/Register.tsx`
- 同上の変更

### Step 4: Settings ページ更新（Web）

**ファイル:** `apps/web/src/pages/Settings.tsx`
- `OAUTH_PROVIDERS` のフィルタリングに `useConfigStore` を使用
- 無効なプロバイダーの連携ボタンを非表示

### Step 5: テスト更新

- `apps/api/` に `GET /api/config` の単体テスト
- `apps/web/src/pages/__tests__/Login.test.tsx` — OAuth非表示パターンのテスト追加
- `apps/web/src/pages/__tests__/Register.test.tsx` — 同上
- `apps/web/src/pages/__tests__/SecuritySettings.test.tsx` — 同上

### Step 6: ドキュメント更新

**ファイル:** `.env.example`
- OAuthセクションのコメント改善（「未設定でOAuth無効」の説明追加）

---

## 変更対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `apps/api/src/routes/config.ts` | **新規** — 公開設定API |
| `apps/api/src/routes/index.ts` | configルート追加 |
| `apps/web/src/lib/api.ts` | configApi追加 |
| `apps/web/src/stores/config.ts` | **新規** — 設定store |
| `apps/web/src/App.tsx` | 設定fetch初期化 |
| `apps/web/src/pages/Login.tsx` | OAuth条件表示 |
| `apps/web/src/pages/Register.tsx` | OAuth条件表示 |
| `apps/web/src/pages/Settings.tsx` | OAuth連携の条件表示 |
| `.env.example` | コメント改善 |

## 既存の再利用パターン

- 環境変数判定: `apps/api/src/config/env.ts` の `env` オブジェクト（`env.GITHUB_CLIENT_ID` 等）
- OAuth条件分岐パターン: `apps/api/src/routes/auth.ts:85` の `if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)` と同じロジック
- Zustand store パターン: `apps/web/src/stores/auth.ts` を参考

## 検証

1. **OAuth無効時**: `.env` から `GITHUB_CLIENT_ID` / `GOOGLE_CLIENT_ID` 関連を削除 → Login/Register画面でOAuthボタンが非表示、Settings画面で連携セクションが非表示
2. **OAuth有効時**: `.env` に設定あり → 従来通りOAuthボタン表示
3. **片方のみ有効**: GitHub のみ設定 → GitHubボタンのみ表示、Googleは非表示
4. **APIテスト**: `docker compose exec dev pnpm test` で全テスト通過
5. **ビルド確認**: `docker compose exec dev pnpm build` 成功
