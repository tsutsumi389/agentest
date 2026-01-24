# 管理者向け組織一覧（ADM-ORG-001）実装計画

## 概要

管理者が全組織を一覧・検索・フィルタリングできるAPIエンドポイントを実装する。
既存の管理者ユーザー一覧API（`GET /admin/users`）のパターンに従い、一貫性のある実装を行う。

## 機能要件

- **機能ID**: ADM-ORG-001
- **権限**: ALL（すべての管理者ロール: SUPER_ADMIN, ADMIN, VIEWER）
- **目的**: 管理者が全組織を閲覧・検索できる

## API仕様

### エンドポイント

```
GET /admin/organizations
```

### クエリパラメータ

| パラメータ | 型 | デフォルト | 説明 |
|-----------|------|-----------|------|
| q | string | - | 検索（名前、スラグで部分一致） |
| plan | string | - | プランフィルタ（カンマ区切り: TEAM,ENTERPRISE） |
| status | string | active | ステータス（active / deleted / all） |
| createdFrom | string | - | 登録日From（ISO 8601） |
| createdTo | string | - | 登録日To（ISO 8601） |
| page | number | 1 | ページ番号（1始まり） |
| limit | number | 20 | 件数（1-100） |
| sortBy | string | createdAt | ソート（createdAt / name / plan） |
| sortOrder | string | desc | 順序（asc / desc） |

### レスポンス

```typescript
{
  organizations: AdminOrganizationListItem[];
  pagination: { page, limit, total, totalPages };
}
```

### 一覧項目（AdminOrganizationListItem）

- id, name, slug, description, avatarUrl
- plan（TEAM / ENTERPRISE）
- billingEmail
- createdAt, updatedAt, deletedAt
- stats: { memberCount, projectCount }
- owner: { id, name, email, avatarUrl } | null

---

## 実装ファイル一覧

### 1. 共通型・スキーマ（packages/shared）

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/types/admin-organizations.ts` | 新規作成 | 型定義 |
| `src/types/index.ts` | 更新 | エクスポート追加 |
| `src/validators/schemas.ts` | 更新 | Zodスキーマ追加 |

### 2. バックエンド（apps/api）

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/services/admin/admin-organizations.service.ts` | 新規作成 | サービス層 |
| `src/controllers/admin/organizations.controller.ts` | 新規作成 | コントローラー |
| `src/routes/admin/organizations.ts` | 新規作成 | ルーティング |
| `src/routes/index.ts` | 更新 | ルート登録 |
| `src/lib/redis-store.ts` | 更新 | キャッシュ関数追加 |

### 3. テスト（apps/api）

| ファイル | 操作 | 内容 |
|---------|------|------|
| `src/__tests__/unit/admin-organizations.service.test.ts` | 新規作成 | サービス単体テスト |
| `src/__tests__/integration/admin-organizations.integration.test.ts` | 新規作成 | 統合テスト |

---

## 実装手順

### Step 1: 共通型・スキーマ

**1.1 型定義を作成**
- ファイル: `packages/shared/src/types/admin-organizations.ts`
- 参考: `packages/shared/src/types/admin-users.ts`

```typescript
// 検索パラメータ
export interface AdminOrganizationSearchParams {
  q?: string;
  plan?: ('TEAM' | 'ENTERPRISE')[];
  status?: 'active' | 'deleted' | 'all';
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'name' | 'plan';
  sortOrder?: 'asc' | 'desc';
}

// 一覧項目
export interface AdminOrganizationListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  plan: 'TEAM' | 'ENTERPRISE';
  billingEmail: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stats: { memberCount: number; projectCount: number; };
  owner: { id: string; name: string; email: string; avatarUrl: string | null; } | null;
}

// レスポンス
export interface AdminOrganizationListResponse {
  organizations: AdminOrganizationListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number; };
}
```

**1.2 Zodスキーマを追加**
- ファイル: `packages/shared/src/validators/schemas.ts`

```typescript
export const adminOrganizationSearchSchema = z.object({
  q: z.string().max(100).optional(),
  plan: z.string().optional()
    .transform((val) => val?.split(',').map((s) => s.trim()))
    .pipe(z.array(organizationPlanSchema).optional()),
  status: z.enum(['active', 'deleted', 'all']).default('active'),
  createdFrom: z.string().datetime().optional(),
  createdTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'name', 'plan']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});
```

### Step 2: Redisキャッシュ関数

- ファイル: `apps/api/src/lib/redis-store.ts`
- `setAdminOrganizationsCache` / `getAdminOrganizationsCache` を追加
- 参考: 既存の `setAdminUsersCache` / `getAdminUsersCache`

### Step 3: サービス層

- ファイル: `apps/api/src/services/admin/admin-organizations.service.ts`
- 参考: `apps/api/src/services/admin/admin-users.service.ts`

主な処理:
1. キャッシュチェック（TTL: 60秒）
2. WHERE句構築（検索、プラン、ステータス、日付フィルタ）
3. Prismaクエリ実行（`_count`で効率的にカウント）
4. オーナー情報取得（`members`でrole='OWNER'を取得）
5. レスポンス変換
6. キャッシュ保存

### Step 4: コントローラー・ルーティング

**4.1 コントローラー**
- ファイル: `apps/api/src/controllers/admin/organizations.controller.ts`
- 参考: `apps/api/src/controllers/admin/users.controller.ts`

**4.2 ルーティング**
- ファイル: `apps/api/src/routes/admin/organizations.ts`

```typescript
router.get('/', requireAdminAuth(), controller.list);
```

**4.3 ルート登録**
- ファイル: `apps/api/src/routes/index.ts`

```typescript
import adminOrganizationsRoutes from './admin/organizations.js';
router.use('/admin/organizations', adminOrganizationsRoutes);
```

### Step 5: テスト

**5.1 サービス単体テスト**
- キャッシュヒット/ミス
- 各フィルタの動作
- ページネーション
- ソート

**5.2 統合テスト**
- 認証チェック（401）
- 検索・フィルタ・ページネーション
- レスポンス形式の検証

---

## 検証方法

### 1. ユニットテスト

```bash
docker compose exec dev pnpm test -- --grep "AdminOrganizationsService"
```

### 2. 統合テスト

```bash
docker compose exec dev pnpm test -- --grep "admin-organizations"
```

### 3. 手動確認（curl）

```bash
# 認証トークン取得後
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/admin/organizations?page=1&limit=10"

# 検索・フィルタ
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/admin/organizations?q=test&plan=TEAM&status=active"
```

### 4. リント

```bash
docker compose exec dev pnpm lint
```

---

## 参考ファイル

| 目的 | ファイルパス |
|------|-------------|
| サービス実装パターン | `apps/api/src/services/admin/admin-users.service.ts` |
| 型定義パターン | `packages/shared/src/types/admin-users.ts` |
| スキーマパターン | `packages/shared/src/validators/schemas.ts` |
| ルーティングパターン | `apps/api/src/routes/admin/users.ts` |
| Redisキャッシュ | `apps/api/src/lib/redis-store.ts` |
| 統合テストパターン | `apps/api/src/__tests__/integration/admin-users.integration.test.ts` |
