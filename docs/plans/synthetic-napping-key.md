# 組織詳細機能（ADM-ORG-002）実装計画

## 概要

システム管理者向け「組織詳細」機能を実装する。既存の `UserDetail.tsx` パターンに準拠し、組織に関する詳細情報を閲覧できる機能を提供する。Phase 1 では閲覧専用機能のみを実装。

**ルーティング**: `/admin/organizations/:id`

---

## 表示セクション

| セクション | 表示内容 |
|-----------|----------|
| ヘッダー | 戻るリンク、アバター、組織名、プランバッジ、削除済みバッジ、説明、ID |
| 基本情報 | 作成日、更新日、削除日 |
| 統計（4カラム） | メンバー数、プロジェクト数、テストスイート数、実行数 |
| メンバー一覧 | 最新20件（アバター、名前→ユーザー詳細リンク、メール、役割、参加日） |
| プロジェクト一覧 | 最新10件（プロジェクト名、メンバー数、スイート数、作成日） |
| サブスクリプション | プラン、ステータス、請求サイクル、期間、請求先メール |
| 監査ログ | 最新10件（日時、カテゴリ、アクション、対象、実行者、IP） |

---

## 実装ファイル一覧

### 1. 型定義（packages/shared）

**`packages/shared/src/types/admin-organizations.ts`** に追加:

```typescript
// 組織メンバー情報
export interface AdminOrganizationMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
}

// 組織プロジェクト情報
export interface AdminOrganizationProject {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  testSuiteCount: number;
  createdAt: string;
}

// 組織サブスクリプション情報
export interface AdminOrganizationSubscription {
  plan: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';
  status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

// 組織監査ログエントリ
export interface AdminOrganizationAuditLogEntry {
  id: string;
  category: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  user: { id: string; name: string; email: string } | null;
  ipAddress: string | null;
  createdAt: string;
}

// 組織詳細統計
export interface AdminOrganizationDetailStats {
  memberCount: number;
  projectCount: number;
  testSuiteCount: number;
  executionCount: number;
}

// 組織詳細
export interface AdminOrganizationDetail {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  plan: 'TEAM' | 'ENTERPRISE';
  billingEmail: string | null;
  paymentCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stats: AdminOrganizationDetailStats;
  members: AdminOrganizationMember[];
  projects: AdminOrganizationProject[];
  subscription: AdminOrganizationSubscription | null;
  recentAuditLogs: AdminOrganizationAuditLogEntry[];
}

// レスポンス型
export interface AdminOrganizationDetailResponse {
  organization: AdminOrganizationDetail;
}
```

---

### 2. API層（apps/api）

#### 2.1 キャッシュ関数
**`apps/api/src/lib/redis-store.ts`** に追加:
- `getAdminOrganizationDetailCache(organizationId)`
- `setAdminOrganizationDetailCache(organizationId, data, ttl=30)`
- `invalidateAdminOrganizationDetailCache(organizationId)`

#### 2.2 サービス
**`apps/api/src/services/admin/admin-organizations.service.ts`** に追加:

```typescript
async findOrganizationById(organizationId: string): Promise<AdminOrganizationDetailResponse | null> {
  // 1. キャッシュチェック
  // 2. Prisma取得（include: members, projects, subscription, auditLogs, _count）
  // 3. テストスイート数・実行数を別途集計
  // 4. レスポンス形式に変換
  // 5. キャッシュ保存（TTL: 30秒）
}
```

#### 2.3 コントローラー
**`apps/api/src/controllers/admin/organizations.controller.ts`** に追加:
- `getById(req, res, next)` - UUIDバリデーション、サービス呼び出し、404ハンドリング

#### 2.4 ルート
**`apps/api/src/routes/admin/organizations.ts`** に追加:
```typescript
router.get('/:id', requireAdminAuth(), controller.getById);
```

---

### 3. フロントエンド（apps/admin）

#### 3.1 APIクライアント
**`apps/admin/src/lib/api.ts`** の `adminOrganizationsApi` に追加:
```typescript
getById: (organizationId: string) =>
  api.get<AdminOrganizationDetailResponse>(`/admin/organizations/${organizationId}`)
```

#### 3.2 フック
**`apps/admin/src/hooks/useAdminOrganizationDetail.ts`** 新規作成:
```typescript
export function useAdminOrganizationDetail(organizationId: string) {
  return useQuery({
    queryKey: ['admin-organization-detail', organizationId],
    queryFn: () => adminOrganizationsApi.getById(organizationId),
    staleTime: 30 * 1000,
    enabled: !!organizationId,
  });
}
```

#### 3.3 コンポーネント（新規作成）
**`apps/admin/src/components/organizations/`** に追加:

| ファイル | 説明 |
|---------|------|
| `OrganizationDetailHeader.tsx` | 戻るリンク + アバター + 組織名 + バッジ |
| `OrganizationStatsSection.tsx` | 4カラム統計グリッド |
| `OrganizationMembersSection.tsx` | メンバーテーブル（ユーザー詳細リンク付き） |
| `OrganizationProjectsSection.tsx` | プロジェクト一覧テーブル |
| `OrganizationSubscriptionSection.tsx` | サブスクリプション情報カード |
| `OrganizationAuditLogSection.tsx` | 監査ログテーブル |

#### 3.4 ページ
**`apps/admin/src/pages/OrganizationDetail.tsx`** 新規作成:
- `UserDetail.tsx` のレイアウト構造を踏襲
- ヘッダー → 基本情報 → 統計 → 2カラム（メンバー/プロジェクト+サブスクリプション） → 監査ログ

#### 3.5 ルーティング
**`apps/admin/src/App.tsx`** に追加:
```typescript
<Route path="/organizations/:id" element={<AuthGuard><OrganizationDetail /></AuthGuard>} />
```

#### 3.6 一覧からのリンク
**`apps/admin/src/components/organizations/OrganizationTable.tsx`** を修正:
- 組織名を `<Link to={`/organizations/${org.id}`}>` でラップ

---

## 実装順序

1. **型定義** - `packages/shared/src/types/admin-organizations.ts`
2. **キャッシュ関数** - `apps/api/src/lib/redis-store.ts`
3. **サービス** - `apps/api/src/services/admin/admin-organizations.service.ts`
4. **コントローラー** - `apps/api/src/controllers/admin/organizations.controller.ts`
5. **ルート** - `apps/api/src/routes/admin/organizations.ts`
6. **APIクライアント** - `apps/admin/src/lib/api.ts`
7. **フック** - `apps/admin/src/hooks/useAdminOrganizationDetail.ts`
8. **コンポーネント群** - `apps/admin/src/components/organizations/`
9. **ページ** - `apps/admin/src/pages/OrganizationDetail.tsx`
10. **ルーティング** - `apps/admin/src/App.tsx`
11. **一覧リンク** - `apps/admin/src/components/organizations/OrganizationTable.tsx`

---

## 検証方法

### API テスト
```bash
# 組織詳細取得
curl -X GET http://localhost:3001/admin/organizations/{orgId} \
  -H "Authorization: Bearer {admin-token}"
```

### 画面テスト
1. `/admin/organizations` で組織一覧を開く
2. 組織名をクリックして詳細画面に遷移
3. 各セクションの表示を確認:
   - 基本情報（作成日・更新日）
   - 統計（メンバー数、プロジェクト数、スイート数、実行数）
   - メンバー一覧（ユーザー詳細へのリンク動作）
   - プロジェクト一覧
   - サブスクリプション情報
   - 監査ログ
4. 更新ボタンでデータ再取得
5. 削除済み組織の表示（削除済みバッジ）

---

## 参照ファイル

| 用途 | ファイル |
|------|----------|
| ページ構造テンプレート | `apps/admin/src/pages/UserDetail.tsx` |
| 統計セクション | `apps/admin/src/components/users/UserStatsSection.tsx` |
| テーブルセクション | `apps/admin/src/components/users/UserOrganizationsSection.tsx` |
| 監査ログセクション | `apps/admin/src/components/users/UserAuditLogSection.tsx` |
| サービスパターン | `apps/api/src/services/admin/admin-users.service.ts` |
