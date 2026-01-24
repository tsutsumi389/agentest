# 管理者向け組織一覧フロントエンド実装計画

## 概要

`apps/admin` に管理者向け組織一覧ページを実装する。既存のユーザー一覧ページ（`Users.tsx`）と同様のパターンに従う。

## 実装ファイル一覧

| ファイル | 操作 | 内容 |
|---------|------|------|
| `apps/admin/src/lib/api.ts` | 更新 | `adminOrganizationsApi` 追加 |
| `apps/admin/src/hooks/useAdminOrganizations.ts` | 新規 | TanStack Queryフック |
| `apps/admin/src/components/organizations/index.ts` | 新規 | エクスポート |
| `apps/admin/src/components/organizations/OrganizationTable.tsx` | 新規 | 組織一覧テーブル |
| `apps/admin/src/components/organizations/OrganizationSearchForm.tsx` | 新規 | 検索フォーム |
| `apps/admin/src/components/organizations/OrganizationFilters.tsx` | 新規 | フィルターUI |
| `apps/admin/src/components/common/OrganizationPlanBadge.tsx` | 新規 | プランバッジ |
| `apps/admin/src/components/common/index.ts` | 更新 | エクスポート追加 |
| `apps/admin/src/pages/Organizations.tsx` | 新規 | 組織一覧ページ |
| `apps/admin/src/App.tsx` | 更新 | ルーティング追加 |

## 実装手順

### Step 1: API関数追加

**ファイル**: `apps/admin/src/lib/api.ts`

```typescript
import type {
  AdminOrganizationSearchParams,
  AdminOrganizationListResponse,
} from '@agentest/shared';

function toOrganizationQueryString(params: AdminOrganizationSearchParams): string {
  const searchParams = new URLSearchParams();
  if (params.q) searchParams.set('q', params.q);
  if (params.plan && params.plan.length > 0) {
    searchParams.set('plan', params.plan.join(','));
  }
  if (params.status) searchParams.set('status', params.status);
  if (params.createdFrom) searchParams.set('createdFrom', params.createdFrom);
  if (params.createdTo) searchParams.set('createdTo', params.createdTo);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export const adminOrganizationsApi = {
  list: (params: AdminOrganizationSearchParams = {}) =>
    api.get<AdminOrganizationListResponse>(`/admin/organizations${toOrganizationQueryString(params)}`),
};
```

### Step 2: カスタムフック作成

**ファイル**: `apps/admin/src/hooks/useAdminOrganizations.ts`

- `useAdminOrganizations(params)` - TanStack Query でデータフェッチ
- 参考: `useAdminUsers.ts`

### Step 3: 共通コンポーネント

**ファイル**: `apps/admin/src/components/common/OrganizationPlanBadge.tsx`

- TEAM: グレー背景
- ENTERPRISE: アクセントカラー背景

### Step 4: 組織一覧コンポーネント

#### OrganizationTable.tsx
- テーブルカラム: 組織（アバター+名前+スラグ）、オーナー、プラン、統計（メンバー/プロジェクト数）、登録日
- ソート可能: name, plan, createdAt
- 削除済み行: opacity-50 + 「削除済み」ラベル
- ページネーション: 前へ/次へ + 件数表示
- 参考: `UserTable.tsx`

#### OrganizationSearchForm.tsx
- デバウンス付き検索（300ms）
- 名前/スラグで部分一致検索
- 参考: `UserSearchForm.tsx`

#### OrganizationFilters.tsx
- プランフィルター: TEAM / ENTERPRISE トグルボタン
- ステータス: アクティブ / 削除済み / すべて
- 登録日範囲: From / To
- クリアボタン
- 参考: `UserFilters.tsx`

### Step 5: ページ作成

**ファイル**: `apps/admin/src/pages/Organizations.tsx`

- URLSearchParams で検索条件管理
- ヘッダー: ナビゲーション（ダッシュボード、ユーザー、組織）
- 検索・フィルターパネル
- 組織一覧テーブル
- 参考: `Users.tsx`

### Step 6: ルーティング追加

**ファイル**: `apps/admin/src/App.tsx`

```typescript
import { Organizations } from './pages/Organizations';

<Route
  path="/organizations"
  element={
    <AuthGuard>
      <Organizations />
    </AuthGuard>
  }
/>
```

### Step 7: ナビゲーション更新

各ページのヘッダーに「組織」リンクを追加（Dashboard.tsx, Users.tsx, Organizations.tsx）

## 型定義（既存・変更なし）

`packages/shared/src/types/admin-organizations.ts`:
- `AdminOrganizationSearchParams`
- `AdminOrganizationListItem`
- `AdminOrganizationListResponse`
- `AdminOrganizationSortBy` ('createdAt' | 'name' | 'plan')
- `AdminOrganizationStatus` ('active' | 'deleted' | 'all')

## 検証方法

```bash
# 1. 開発サーバー起動
cd docker && docker compose up

# 2. 管理画面にアクセス
# http://localhost:5175/organizations

# 3. 動作確認
# - 組織一覧が表示される
# - 検索（名前/スラグ）が動作する
# - フィルタリング（プラン、ステータス、日付）が動作する
# - ソート（名前、プラン、登録日）が動作する
# - ページネーションが動作する
# - 削除済み組織が半透明で表示される

# 4. リント
docker compose exec dev pnpm lint
```

## 参考ファイル

| 目的 | ファイルパス |
|------|-------------|
| ページ実装パターン | `apps/admin/src/pages/Users.tsx` |
| テーブルコンポーネント | `apps/admin/src/components/users/UserTable.tsx` |
| フィルターUI | `apps/admin/src/components/users/UserFilters.tsx` |
| 検索フォーム | `apps/admin/src/components/users/UserSearchForm.tsx` |
| APIクライアント | `apps/admin/src/lib/api.ts` |
| カスタムフック | `apps/admin/src/hooks/useAdminUsers.ts` |
| 型定義 | `packages/shared/src/types/admin-organizations.ts` |
