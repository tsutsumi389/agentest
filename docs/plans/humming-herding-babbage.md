# ユーザー詳細画面（ADM-USR-002）実装計画

## 概要

管理者向けユーザー詳細画面を実装する。ユーザー一覧（ADM-USR-001）からの遷移先として、個別ユーザーの詳細情報を閲覧できる画面を提供する。

---

## 実装内容

### 表示する情報

| カテゴリ | 表示項目 |
|---------|---------|
| 基本情報 | ID、メール、名前、アバター、プラン、作成日、更新日、削除日 |
| アクティビティ | 最終アクティブ日時、アクティブセッション数 |
| 統計 | 所属組織数、参加プロジェクト数、テストスイート作成数、テスト実行数 |
| 所属組織 | 組織名、役割、参加日（テーブル形式） |
| OAuth連携 | 連携中プロバイダー（GitHub、Google等） |
| サブスクリプション | プラン、ステータス、請求サイクル、次回更新日 |
| 監査ログ | 最近10件のログ（日時、カテゴリ、アクション、IP） |

---

## 実装手順

### Step 1: 型定義の追加

**ファイル**: `packages/shared/src/types/admin-users.ts`

```typescript
// 追加する型
export interface AdminUserOrganization {
  id: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

export interface AdminUserOAuthProvider {
  provider: string;
  createdAt: string;
}

export interface AdminUserSubscription {
  plan: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface AdminUserAuditLogEntry {
  id: string;
  category: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  plan: 'FREE' | 'PRO';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  activity: {
    lastActiveAt: string | null;
    activeSessionCount: number;
  };
  stats: {
    organizationCount: number;
    projectCount: number;
    testSuiteCount: number;
    executionCount: number;
  };
  organizations: AdminUserOrganization[];
  oauthProviders: AdminUserOAuthProvider[];
  subscription: AdminUserSubscription | null;
  recentAuditLogs: AdminUserAuditLogEntry[];
}

export interface AdminUserDetailResponse {
  user: AdminUserDetail;
}
```

---

### Step 2: Redisキャッシュ関数の追加

**ファイル**: `apps/api/src/lib/redis-store.ts`

- `ADMIN_USER_DETAIL` プレフィックス追加
- `getAdminUserDetailCache(userId)` 関数追加
- `setAdminUserDetailCache(userId, data, ttl=30)` 関数追加
- `invalidateAdminUserDetailCache(userId)` 関数追加

---

### Step 3: サービス層の拡張

**ファイル**: `apps/api/src/services/admin/admin-users.service.ts`

```typescript
async findUserById(userId: string): Promise<AdminUserDetailResponse> {
  // 1. Redisキャッシュ確認
  // 2. Prismaクエリ実行（下記include構造）
  // 3. レスポンス変換
  // 4. キャッシュ保存（TTL: 30秒）
}
```

**Prismaクエリ**:
```typescript
prisma.user.findUnique({
  where: { id: userId },
  include: {
    sessions: {
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
      select: { lastActiveAt: true },
    },
    organizationMembers: {
      where: { organization: { deletedAt: null } },
      include: { organization: { select: { id: true, name: true } } },
    },
    accounts: { select: { provider: true, createdAt: true } },
    subscription: true,
    auditLogs: {
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, category: true, action: true, targetType: true, targetId: true, ipAddress: true, createdAt: true },
    },
    _count: {
      select: {
        projectMembers: { where: { project: { deletedAt: null } } },
        testSuites: { where: { deletedAt: null } },
        executions: true,
      },
    },
  },
})
```

---

### Step 4: コントローラーの拡張

**ファイル**: `apps/api/src/controllers/admin/users.controller.ts`

```typescript
getById = async (req: Request, res: Response, next: NextFunction) => {
  // 1. 認証チェック
  // 2. UUIDバリデーション
  // 3. サービス呼び出し
  // 4. レスポンス返却
}
```

---

### Step 5: ルートの追加

**ファイル**: `apps/api/src/routes/admin/users.ts`

```typescript
router.get('/:id', requireAdminAuth(), controller.getById);
```

---

### Step 6: フロントエンドAPIクライアントの拡張

**ファイル**: `apps/admin/src/lib/api.ts`

```typescript
export const adminUsersApi = {
  list: (params) => api.get<AdminUserListResponse>(`/admin/users${toQueryString(params)}`),
  getById: (userId: string) => api.get<AdminUserDetailResponse>(`/admin/users/${userId}`),
};
```

---

### Step 7: カスタムフックの作成

**ファイル**: `apps/admin/src/hooks/useAdminUserDetail.ts`

```typescript
export function useAdminUserDetail(userId: string) {
  return useQuery({
    queryKey: ['admin-user-detail', userId],
    queryFn: () => adminUsersApi.getById(userId),
    staleTime: 30 * 1000,
    enabled: !!userId,
  });
}
```

---

### Step 8: UIコンポーネントの作成

**ディレクトリ**: `apps/admin/src/components/users/`

| ファイル | 責務 |
|---------|------|
| `UserDetailHeader.tsx` | アバター、名前、メール、プラン、ステータスバッジ |
| `UserActivitySection.tsx` | 最終アクティブ日時、セッション数 |
| `UserStatsSection.tsx` | 統計情報カード（組織数、プロジェクト数、スイート数、実行数） |
| `UserOrganizationsSection.tsx` | 所属組織テーブル |
| `UserOAuthSection.tsx` | OAuth連携プロバイダー一覧 |
| `UserSubscriptionSection.tsx` | サブスクリプション情報カード |
| `UserAuditLogSection.tsx` | 監査ログテーブル（最近10件） |

---

### Step 9: 詳細ページの作成

**ファイル**: `apps/admin/src/pages/UserDetail.tsx`

- useParams で userId 取得
- useAdminUserDetail フックでデータ取得
- 各セクションコンポーネントを配置
- ローディング/エラー/データ表示の3状態を処理
- 「戻る」ボタンで /users へ遷移

---

### Step 10: ルーティングの追加

**ファイル**: `apps/admin/src/App.tsx`

```typescript
<Route
  path="/users/:id"
  element={
    <AuthGuard>
      <UserDetail />
    </AuthGuard>
  }
/>
```

---

### Step 11: 一覧画面からのリンク追加

**ファイル**: `apps/admin/src/components/users/UserTable.tsx`

- ユーザー名を `<Link to={/users/${user.id}}>` でラップ
- ホバー時にアンダーライン表示

---

### Step 12: APIドキュメントの更新

**ファイル**: `docs/api/admin-users.md`

- `GET /admin/users/:id` エンドポイントのドキュメント追加

---

## 修正対象ファイル一覧

| ファイル | 操作 |
|---------|------|
| `packages/shared/src/types/admin-users.ts` | 型追加 |
| `apps/api/src/lib/redis-store.ts` | キャッシュ関数追加 |
| `apps/api/src/services/admin/admin-users.service.ts` | メソッド追加 |
| `apps/api/src/controllers/admin/users.controller.ts` | メソッド追加 |
| `apps/api/src/routes/admin/users.ts` | ルート追加 |
| `apps/admin/src/lib/api.ts` | API関数追加 |
| `apps/admin/src/hooks/useAdminUserDetail.ts` | 新規作成 |
| `apps/admin/src/components/users/UserDetailHeader.tsx` | 新規作成 |
| `apps/admin/src/components/users/UserActivitySection.tsx` | 新規作成 |
| `apps/admin/src/components/users/UserStatsSection.tsx` | 新規作成 |
| `apps/admin/src/components/users/UserOrganizationsSection.tsx` | 新規作成 |
| `apps/admin/src/components/users/UserOAuthSection.tsx` | 新規作成 |
| `apps/admin/src/components/users/UserSubscriptionSection.tsx` | 新規作成 |
| `apps/admin/src/components/users/UserAuditLogSection.tsx` | 新規作成 |
| `apps/admin/src/components/users/index.ts` | エクスポート追加 |
| `apps/admin/src/pages/UserDetail.tsx` | 新規作成 |
| `apps/admin/src/App.tsx` | ルート追加 |
| `apps/admin/src/components/users/UserTable.tsx` | リンク追加 |
| `docs/api/admin-users.md` | ドキュメント追加 |

---

## 検証方法

### バックエンドテスト

```bash
docker compose exec dev pnpm test -- apps/api
```

- `findUserById` が正しいデータを返すこと
- 存在しないユーザーIDで404エラーが返ること
- 無効なUUIDで400エラーが返ること
- Redisキャッシュが機能すること

### フロントエンドテスト

```bash
docker compose exec dev pnpm test -- apps/admin
```

- 各セクションコンポーネントが正しくレンダリングされること
- ローディング/エラー状態が正しく表示されること

### E2Eテスト

1. 管理者としてログイン
2. `/users` へ遷移
3. ユーザー名をクリック
4. `/users/:id` へ遷移することを確認
5. 各セクションの情報が正しく表示されることを確認
6. 「戻る」ボタンで `/users` へ戻ることを確認

### 手動テスト

```bash
# APIテスト
curl -X GET http://localhost:3000/admin/users/{userId} \
  -H "Cookie: admin_session=..."
```
