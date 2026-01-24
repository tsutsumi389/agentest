# ユーザー一覧機能（ADM-USR-001）実装計画

## 概要

管理者が全ユーザーを一覧表示・検索・フィルタリングできる機能を実装する。
既存の管理者ダッシュボード実装パターンに従う。

- **ID**: ADM-USR-001
- **権限**: ALL（SUPER_ADMIN, ADMIN, VIEWER）
- **依存**: Phase 0（管理者認証基盤）✅実装済み

---

## 1. API設計

### エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/admin/users` | ユーザー一覧取得 |

### リクエストパラメータ（Query）

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `q` | string | - | メール・名前で部分一致検索 |
| `plan` | string | - | プラン（FREE,PRO）カンマ区切り |
| `status` | enum | `active` | active / deleted / all |
| `createdFrom` | datetime | - | 登録日From |
| `createdTo` | datetime | - | 登録日To |
| `page` | number | 1 | ページ番号 |
| `limit` | number | 20 | 1ページあたり件数（max: 100）|
| `sortBy` | enum | `createdAt` | createdAt / name / email / plan |
| `sortOrder` | enum | `desc` | asc / desc |

### レスポンス

```typescript
interface AdminUserListResponse {
  users: AdminUserListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: 'FREE' | 'PRO';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stats: {
    organizationCount: number;
    projectCount: number;
    lastActiveAt: string | null;
  };
}
```

---

## 2. 実装ファイル一覧

### 新規作成

| ファイル | 説明 |
|----------|------|
| `packages/shared/src/types/admin-users.ts` | 型定義 |
| `apps/api/src/routes/admin/users.ts` | ルート定義 |
| `apps/api/src/controllers/admin/users.controller.ts` | コントローラー |
| `apps/api/src/services/admin/admin-users.service.ts` | サービス |
| `apps/admin/src/pages/Users.tsx` | ユーザー一覧ページ |
| `apps/admin/src/components/users/UserTable.tsx` | テーブルコンポーネント |
| `apps/admin/src/components/users/UserSearchForm.tsx` | 検索フォーム |
| `apps/admin/src/components/users/UserFilters.tsx` | フィルタUI |
| `apps/admin/src/hooks/useAdminUsers.ts` | データ取得フック |

### 修正

| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/validators/schemas.ts` | `adminUserSearchSchema` 追加 |
| `packages/shared/src/types/index.ts` | エクスポート追加 |
| `apps/api/src/lib/redis-store.ts` | キャッシュ関数追加 |
| `apps/api/src/app.ts` | ルート登録追加 |
| `apps/admin/src/lib/api.ts` | APIクライアント追加 |
| `apps/admin/src/App.tsx` | ルート追加 |

---

## 3. バックエンド実装詳細

### 3.1 サービス層

`apps/api/src/services/admin/admin-users.service.ts`

```typescript
export class AdminUsersService {
  async findUsers(params: AdminUserSearchParams): Promise<AdminUserListResponse> {
    // 1. キャッシュチェック（TTL: 60秒）
    // 2. WHERE句構築
    // 3. 並列クエリ実行（ユーザー取得 + カウント）
    // 4. レスポンス形式に変換
    // 5. キャッシュ保存
  }
}
```

**クエリ最適化**:
- `Promise.all` で並列実行
- `include` でリレーションを最小限に
- Redis キャッシュ（TTL: 1分）

### 3.2 WHERE句構築

```typescript
// 検索（OR条件）
if (q) {
  where.OR = [
    { email: { contains: q, mode: 'insensitive' } },
    { name: { contains: q, mode: 'insensitive' } },
  ];
}

// プランフィルタ
if (plan?.length) where.plan = { in: plan };

// ステータスフィルタ
if (status === 'active') where.deletedAt = null;
if (status === 'deleted') where.deletedAt = { not: null };

// 日付フィルタ
if (createdFrom) where.createdAt = { gte: new Date(createdFrom) };
```

---

## 4. フロントエンド実装詳細

### 4.1 状態管理

- **データ取得**: React Query（`useAdminUsers`フック）
- **検索条件**: URLSearchParams で永続化
- **キャッシュ**: staleTime 1分

### 4.2 ページ構成

```
UsersPage
├── Header（タイトル + 更新ボタン）
├── SearchForm（テキスト検索）
├── Filters（プラン・ステータス・日付）
└── UserTable
    ├── ソート可能なヘッダー
    ├── ユーザー行（アバター・名前・メール・プラン・統計）
    └── ページネーション
```

### 4.3 UIパターン

- ダッシュボード（`Dashboard.tsx`）と同様のヘッダー構造
- Tailwind CSSで統一されたスタイリング
- lucide-react アイコン使用

---

## 5. 実装順序

### Phase 1: バックエンド

1. 型定義（`packages/shared/src/types/admin-users.ts`）
2. バリデーション（`packages/shared/src/validators/schemas.ts`）
3. キャッシュ関数（`apps/api/src/lib/redis-store.ts`）
4. サービス（`apps/api/src/services/admin/admin-users.service.ts`）
5. コントローラー（`apps/api/src/controllers/admin/users.controller.ts`）
6. ルート（`apps/api/src/routes/admin/users.ts`）
7. app.ts への登録

### Phase 2: フロントエンド

1. APIクライアント（`apps/admin/src/lib/api.ts`）
2. フック（`apps/admin/src/hooks/useAdminUsers.ts`）
3. コンポーネント群（`apps/admin/src/components/users/`）
4. ページ（`apps/admin/src/pages/Users.tsx`）
5. ルート追加（`apps/admin/src/App.tsx`）

### Phase 3: テスト

1. サービスユニットテスト
2. API結合テスト

---

## 6. テスト戦略

### ユニットテスト

`apps/api/src/__tests__/unit/admin-users.service.test.ts`

- デフォルトパラメータでの取得
- 検索クエリフィルタリング
- プランフィルタリング
- ステータスフィルタリング
- ページネーション動作

### 結合テスト

`apps/api/src/__tests__/integration/admin-users.integration.test.ts`

- 認証済み管理者がユーザー一覧を取得できる
- 未認証の場合は401エラー
- 検索・フィルタ・ソート・ページネーションの動作確認
- VIEWERロールでもアクセス可能

---

## 7. 検証方法

### 手動検証

1. **Docker環境起動**
   ```bash
   cd docker && docker compose up
   ```

2. **管理者ログイン**
   - `http://localhost:5174/login` にアクセス
   - シードデータの管理者でログイン

3. **ユーザー一覧画面確認**
   - `/users` に遷移
   - 一覧表示・検索・フィルタ・ソート・ページネーションを確認

### 自動テスト

```bash
docker compose exec dev pnpm test
```

---

## 8. 参照ファイル（既存パターン）

| ファイル | 参照内容 |
|----------|----------|
| `apps/api/src/services/admin/admin-dashboard.service.ts` | サービス層パターン |
| `apps/api/src/routes/admin/dashboard.ts` | ルート定義パターン |
| `apps/admin/src/hooks/useAdminDashboard.ts` | React Queryフックパターン |
| `apps/admin/src/pages/Dashboard.tsx` | ページコンポーネントパターン |
| `apps/api/src/repositories/audit-log.repository.ts` | ページネーションクエリパターン |
