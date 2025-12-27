# Phase 2: フロントエンド詳細設計

## 概要

組織・権限管理機能のフロントエンド実装詳細。ページ、コンポーネント、ストア、API クライアントの設計と実装を記述する。

---

## ルーティング

**ファイル:** `apps/web/src/App.tsx`

```typescript
<Routes>
  {/* 組織一覧 */}
  <Route path="organizations" element={<OrganizationsPage />} />

  {/* 組織設定 */}
  <Route path="organizations/:organizationId/settings" element={<OrganizationSettingsPage />} />

  {/* 招待承諾 */}
  <Route path="invitations/:token" element={<InvitationAcceptPage />} />
</Routes>
```

---

## ページコンポーネント

### Organizations（組織一覧）

**ファイル:** `apps/web/src/pages/Organizations.tsx`

#### 機能

- 所属組織の一覧表示（カード形式）
- 検索フィルタ（名前/スラッグ）
- 組織作成モーダル
- 削除済み組織の復元（OWNER のみ）
- 組織選択でダッシュボードへ遷移

#### 状態

```typescript
const [searchQuery, setSearchQuery] = useState('');
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
const [restoringId, setRestoringId] = useState<string | null>(null);
const [restoreTarget, setRestoreTarget] = useState<Organization | null>(null);
```

#### UI 構成

```
┌─────────────────────────────────────────────────────────────┐
│ 組織                                        [+ 組織を作成]  │
├─────────────────────────────────────────────────────────────┤
│ [検索フィルタ]                                              │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ Org Card    │ │ Org Card    │ │ Org Card    │            │
│ │ (Active)    │ │ (Active)    │ │ (Deleted)   │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

### OrganizationSettings（組織設定）

**ファイル:** `apps/web/src/pages/OrganizationSettings.tsx`

#### タブ構成

| タブ | 権限 | 説明 |
|------|------|------|
| 一般設定 | OWNER/ADMIN | 組織名、説明、請求先メール |
| メンバー | 全員 | メンバー一覧・管理 |
| 招待 | OWNER/ADMIN | 招待一覧・新規招待 |
| 監査ログ | OWNER/ADMIN | 操作履歴表示 |
| 危険な操作 | OWNER | オーナー移譲、組織削除 |

#### 権限制御

```typescript
const { hasPermission } = useHasOrganizationPermission(['OWNER', 'ADMIN']);
const { currentRole } = useOrganizationContext();

// MEMBER は設定タブ・招待タブ・監査ログタブにアクセス不可
// 危険な操作タブは OWNER のみ表示
```

#### フォームバリデーション

```typescript
// 一般設定
const generalSettingsSchema = {
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  billingEmail: z.string().email().optional().or(z.literal('')),
};
```

---

### InvitationAccept（招待承諾）

**ファイル:** `apps/web/src/pages/InvitationAccept.tsx`

#### シナリオ別画面

| シナリオ | 表示内容 |
|----------|----------|
| 未認証 | ログインを促すメッセージ + ログインボタン |
| 認証済み・メール不一致 | 警告メッセージ + ログアウトボタン |
| 認証済み・自分宛て・pending | 組織情報 + 承諾/辞退ボタン |
| accepted | 「既に承諾済み」メッセージ |
| declined | 「辞退済み」メッセージ |
| expired | 「期限切れ」メッセージ |

#### フロー

```
1. URL パラメータからトークン取得
2. API で招待詳細取得（認証不要）
3. ステータス判定
4. 適切な画面表示
5. 承諾/辞退時に確認ダイアログ
6. 成功時にメッセージ表示
```

---

## コンポーネント

### OrganizationSelector

**ファイル:** `apps/web/src/components/organization/OrganizationSelector.tsx`

#### 機能

- ナビゲーション用のドロップダウン
- 個人モード/組織モードの切り替え
- 所属組織一覧表示
- 組織作成リンク
- 現在選択中の組織設定へのリンク

#### UI

```
┌─────────────────────────────┐
│ [Icon] 個人 / 組織名    ▼  │
├─────────────────────────────┤
│ ○ 個人                      │
│ ─────────────────────────── │
│ ● Organization A (OWNER)   │
│ ○ Organization B (ADMIN)   │
│ ○ Organization C (MEMBER)  │
│ ─────────────────────────── │
│ + 組織を作成               │
│ ⚙ 組織設定                 │
└─────────────────────────────┘
```

#### Props

```typescript
interface OrganizationSelectorProps {
  className?: string;
}
```

---

### OrganizationCard

**ファイル:** `apps/web/src/components/organization/OrganizationCard.tsx`

#### 表示内容

- 組織名・スラッグ
- 説明（最大2行）
- メンバー数
- ロールバッジ（Crown: OWNER, Shield: ADMIN, User: MEMBER）
- 削除予定日数バッジ（削除済み時）

#### アクション

| 状態 | アクション |
|------|-----------|
| アクティブ | 設定ボタン + 選択ボタン |
| 削除済み（OWNER） | 復元ボタン |
| 削除済み（非OWNER） | 復元待ちメッセージ |

#### Props

```typescript
interface OrganizationCardProps {
  organization: Organization;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  onSelect: (id: string) => void;
  onRestore?: (id: string) => void;
  isRestoring?: boolean;
}
```

---

### CreateOrganizationModal

**ファイル:** `apps/web/src/components/organization/CreateOrganizationModal.tsx`

#### フォームフィールド

| フィールド | 必須 | バリデーション |
|-----------|------|---------------|
| 組織名 | はい | 1-100文字 |
| スラッグ | はい | 2-50文字、英数字とハイフン |
| 説明 | いいえ | 0-500文字 |

#### スラッグ自動生成

```typescript
// 組織名から自動生成（手動編集まで）
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
};
```

#### サーバーエラー処理

```typescript
// スラッグ重複エラーをフィールドエラーに変換
if (error.message.includes('slug')) {
  setFieldError('slug', 'このスラッグは既に使用されています');
}
```

---

### MemberList

**ファイル:** `apps/web/src/components/organization/MemberList.tsx`

#### 機能

- メンバー一覧表示（ロール順でソート）
- ロール変更ドロップダウン
- メンバー削除（確認ダイアログ付き）
- 操作不可理由のツールチップ表示

#### ロール優先度

```typescript
const ROLE_ORDER = { OWNER: 0, ADMIN: 1, MEMBER: 2 };
```

#### 権限制御

| 操作者 | OWNER | ADMIN | MEMBER |
|--------|-------|-------|--------|
| OWNER | - | 変更/削除可 | 変更/削除可 |
| ADMIN | 不可 | 変更/削除可 | 変更/削除可 |
| MEMBER | 不可 | 不可 | 不可 |

#### UI

```
┌────────────────────────────────────────────────────────┐
│ メンバー                                               │
├────────────────────────────────────────────────────────┤
│ [Avatar] John Doe         Owner           [削除不可]   │
│ [Avatar] Jane Smith       [ADMIN ▼]       [削除]      │
│ [Avatar] Bob Wilson       [MEMBER ▼]      [削除]      │
└────────────────────────────────────────────────────────┘
```

---

### InvitationList

**ファイル:** `apps/web/src/components/organization/InvitationList.tsx`

#### 表示内容

- メールアドレス
- ロールバッジ
- 招待者
- ステータスバッジ（期限切れ/期限間近/有効）
- 有効期限

#### ステータス判定

```typescript
const getStatus = (invitation: OrganizationInvitation) => {
  const now = new Date();
  const expiresAt = new Date(invitation.expiresAt);

  if (expiresAt < now) return 'expired';
  if (expiresAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000) return 'expiring-soon';
  return 'valid';
};
```

#### ソート順

1. 期限切れ
2. 期限間近
3. 有効
4. 同ステータス内は作成日時の新しい順

#### アクション

- 招待リンクコピー（クリップボード）
- 招待取消（確認ダイアログ付き）

---

### InviteMemberModal

**ファイル:** `apps/web/src/components/organization/InviteMemberModal.tsx`

#### フロー

```
1. メールアドレス + ロール入力
2. 招待送信
3. 成功時：招待リンク表示画面に切り替え
4. リンクコピー or モーダルを閉じる
```

#### UI（招待成功後）

```
┌─────────────────────────────────────────────────────────┐
│ 招待を送信しました                                      │
├─────────────────────────────────────────────────────────┤
│ 以下のリンクを招待対象者に共有してください              │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ https://app.example.com/invitations/abc123... [Copy] │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│                                            [閉じる]     │
└─────────────────────────────────────────────────────────┘
```

---

### AuditLogList

**ファイル:** `apps/web/src/components/organization/AuditLogList.tsx`

#### テーブルカラム

| カラム | 説明 |
|--------|------|
| ユーザー | アバター + 名前 |
| カテゴリ | 色付きバッジ + アイコン |
| アクション | アクション名 |
| 対象 | 対象タイプ |
| 日時 | 相対時間（hover で絶対時間） |

#### カテゴリ表示

| カテゴリ | 色 | アイコン |
|----------|-----|----------|
| AUTH | gray | Shield |
| USER | blue | User |
| ORGANIZATION | purple | Building2 |
| MEMBER | green | Users |
| PROJECT | orange | FolderKanban |
| API_TOKEN | yellow | Key |
| BILLING | red | CreditCard |

#### フィルタ

- カテゴリフィルタ（全て/各カテゴリ）
- 日付範囲フィルタ（開始日-終了日）

#### ページネーション

- ページサイズ選択（10/20/50/100）
- 前後ページボタン
- 総件数表示

---

### TransferOwnershipModal

**ファイル:** `apps/web/src/components/organization/TransferOwnershipModal.tsx`

#### フロー

```
1. メンバー選択（自分以外）
2. 組織名入力で確認
3. 移譲実行
```

#### UI

```
┌─────────────────────────────────────────────────────────┐
│ オーナー権限の移譲                                      │
├─────────────────────────────────────────────────────────┤
│ この操作は取り消せません。移譲後、あなたは              │
│ 管理者（ADMIN）に降格されます。                        │
│                                                         │
│ 新しいオーナーを選択:                                  │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Avatar] Jane Smith (ADMIN)                    ○   │ │
│ │ [Avatar] Bob Wilson (MEMBER)                   ○   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 確認のため組織名を入力してください:                    │
│ [                                                     ] │
│                                                         │
│                              [キャンセル] [移譲を実行] │
└─────────────────────────────────────────────────────────┘
```

---

### DeleteOrganizationModal

**ファイル:** `apps/web/src/components/organization/DeleteOrganizationModal.tsx`

#### 説明

- 論理削除（30日以内は復元可能）
- 30日経過後は完全削除

#### 確認

- 組織名の完全一致で削除ボタン有効化

#### UI

```
┌─────────────────────────────────────────────────────────┐
│ 組織の削除                                              │
├─────────────────────────────────────────────────────────┤
│ この操作により、組織「Example Org」は削除されます。     │
│                                                         │
│ 削除後30日以内であれば復元可能です。                   │
│ 30日経過後は完全に削除され、復元できなくなります。     │
│                                                         │
│ 確認のため組織名を入力してください:                    │
│ [                                                     ] │
│                                                         │
│                               [キャンセル] [削除する]   │
└─────────────────────────────────────────────────────────┘
```

---

## ストア

### organization.ts

**ファイル:** `apps/web/src/stores/organization.ts`

#### 状態

```typescript
interface OrganizationState {
  organizations: Array<{
    organization: Organization;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  }>;
  selectedOrganizationId: string | null;
  isLoading: boolean;
  error: string | null;
}
```

#### アクション

```typescript
interface OrganizationActions {
  setOrganizations: (orgs: OrganizationState['organizations']) => void;
  selectOrganization: (id: string | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addOrganization: (org: { organization: Organization; role: 'OWNER' }) => void;
  updateOrganization: (org: Organization) => void;
  removeOrganization: (id: string) => void;
  reset: () => void;
}
```

#### 永続化

```typescript
// localStorage に selectedOrganizationId のみ保存
persist(
  (set) => ({ ... }),
  {
    name: 'organization-storage',
    partialize: (state) => ({ selectedOrganizationId: state.selectedOrganizationId }),
  }
)
```

#### セレクター

```typescript
// 現在選択中の組織
export const useSelectedOrganization = () => {
  return useOrganizationStore((state) => {
    if (!state.selectedOrganizationId) return null;
    return state.organizations.find(
      (o) => o.organization.id === state.selectedOrganizationId
    );
  });
};

// 現在のロール
export const useCurrentOrganizationRole = () => {
  const selected = useSelectedOrganization();
  return selected?.role ?? null;
};
```

---

## コンテキスト

### OrganizationContext

**ファイル:** `apps/web/src/contexts/OrganizationContext.tsx`

#### 値

```typescript
interface OrganizationContextValue {
  organizations: Array<{ organization: Organization; role: OrganizationRole }>;
  selectedOrganization: { organization: Organization; role: OrganizationRole } | null;
  currentRole: OrganizationRole | null;
  isLoading: boolean;
  error: string | null;
  selectOrganization: (id: string | null) => void;
  refreshOrganizations: () => Promise<void>;
  isPersonalMode: boolean;
}
```

#### 初期化

```typescript
useEffect(() => {
  if (user) {
    // 削除済み組織を含めて取得（復元機能用）
    usersApi.getOrganizations(user.id, { includeDeleted: true })
      .then(setOrganizations);
  }
}, [user]);
```

#### 権限チェックフック

```typescript
export const useHasOrganizationPermission = (requiredRoles: OrganizationRole[]) => {
  const { currentRole } = useOrganizationContext();
  return {
    hasPermission: currentRole ? requiredRoles.includes(currentRole) : false,
  };
};
```

---

## API クライアント

**ファイル:** `apps/web/src/lib/api.ts`

### 型定義

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  billingEmail: string | null;
  plan: 'TEAM' | 'ENTERPRISE';
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  _count?: {
    members: number;
  };
}

interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

interface OrganizationInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface InvitationDetail {
  invitation: OrganizationInvitation;
  organization: Organization;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

interface AuditLog {
  id: string;
  organizationId: string | null;
  userId: string | null;
  category: 'AUTH' | 'USER' | 'ORGANIZATION' | 'MEMBER' | 'PROJECT' | 'API_TOKEN' | 'BILLING';
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  } | null;
}
```

### API メソッド

```typescript
export const organizationsApi = {
  // 組織作成
  create: (data: { name: string; slug: string; description?: string }) =>
    apiClient.post<{ organization: Organization }>('/organizations', data),

  // 組織詳細取得
  getById: (id: string) =>
    apiClient.get<{ organization: Organization }>(`/organizations/${id}`),

  // 組織更新
  update: (id: string, data: Partial<Organization>) =>
    apiClient.patch<{ organization: Organization }>(`/organizations/${id}`, data),

  // 組織削除
  delete: (id: string) =>
    apiClient.delete(`/organizations/${id}`),

  // 組織復元
  restore: (id: string) =>
    apiClient.post<{ organization: Organization }>(`/organizations/${id}/restore`),

  // メンバー一覧
  getMembers: (id: string) =>
    apiClient.get<{ members: OrganizationMember[] }>(`/organizations/${id}/members`),

  // メンバー招待
  invite: (id: string, data: { email: string; role: 'ADMIN' | 'MEMBER' }) =>
    apiClient.post<{ invitation: OrganizationInvitation; invitationUrl: string }>(
      `/organizations/${id}/invitations`,
      data
    ),

  // 招待一覧
  getInvitations: (id: string) =>
    apiClient.get<{ invitations: OrganizationInvitation[] }>(
      `/organizations/${id}/invitations`
    ),

  // 招待取消
  cancelInvitation: (orgId: string, invitationId: string) =>
    apiClient.delete(`/organizations/${orgId}/invitations/${invitationId}`),

  // 招待詳細取得（認証不要）
  getInvitationByToken: (token: string) =>
    apiClient.get<InvitationDetail>(`/organizations/invitations/${token}`),

  // 招待承諾
  acceptInvitation: (token: string) =>
    apiClient.post<{ organization: Organization; role: string }>(
      `/organizations/invitations/${token}/accept`
    ),

  // 招待辞退
  declineInvitation: (token: string) =>
    apiClient.post(`/organizations/invitations/${token}/decline`),

  // ロール更新
  updateMemberRole: (orgId: string, userId: string, role: 'ADMIN' | 'MEMBER') =>
    apiClient.patch<{ member: OrganizationMember }>(
      `/organizations/${orgId}/members/${userId}`,
      { role }
    ),

  // メンバー削除
  removeMember: (orgId: string, userId: string) =>
    apiClient.delete(`/organizations/${orgId}/members/${userId}`),

  // オーナー移譲
  transferOwnership: (orgId: string, newOwnerId: string) =>
    apiClient.post(`/organizations/${orgId}/transfer-ownership`, { newOwnerId }),

  // 監査ログ取得
  getAuditLogs: (
    orgId: string,
    params?: {
      page?: number;
      limit?: number;
      category?: string;
      startDate?: string;
      endDate?: string;
    }
  ) =>
    apiClient.get<{ logs: AuditLog[]; total: number; page: number; limit: number }>(
      `/organizations/${orgId}/audit-logs`,
      { params }
    ),

  // プロジェクト一覧
  getProjects: (id: string) =>
    apiClient.get<{ projects: Project[] }>(`/organizations/${id}/projects`),
};
```

---

## アクセシビリティ

### モーダルコンポーネント共通

- フォーカストラップ（Tab キーでモーダル内を循環）
- ESC キーでクローズ
- 背景クリックでクローズ（オプション）
- `aria-modal="true"`
- `role="dialog"`
- `aria-labelledby` でタイトル参照

### フォームバリデーション

- `aria-invalid` でエラー状態を通知
- `aria-describedby` でエラーメッセージ参照
- リアルタイムバリデーションフィードバック

### ドロップダウン

- 外側クリックで自動クローズ
- ESC キーでクローズ
- 矢印キーで項目選択
- Enter/Space で決定

---

## エラーハンドリング

### API エラー

```typescript
try {
  await organizationsApi.create(data);
  toast.success('組織を作成しました');
} catch (error) {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      // 重複エラー
      setFieldError('slug', 'このスラッグは既に使用されています');
    } else {
      toast.error(error.message);
    }
  } else {
    toast.error('予期しないエラーが発生しました');
  }
}
```

### ローディング状態

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await api.call();
  } finally {
    setIsLoading(false);
  }
};
```

---

## デザインパターン

### Terminal/CLI 風スタイル

- モノスペースフォント使用
- ミニマルなカラーパレット
- ボーダーベースのカード
- シンプルなアイコン

### タブ UI

既存の `Settings.tsx` のパターンを踏襲：

```tsx
const [activeTab, setActiveTab] = useState('general');

return (
  <div className="flex border-b border-gray-700">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={cn(
          'px-4 py-2 text-sm',
          activeTab === tab.id
            ? 'border-b-2 border-green-500 text-white'
            : 'text-gray-400 hover:text-white'
        )}
      >
        {tab.label}
      </button>
    ))}
  </div>
);
```

### 確認ダイアログ

重要な操作（削除、移譲など）には確認ダイアログを表示：

- 操作内容の明確な説明
- 組織名入力による確認（削除・移譲）
- キャンセルボタンを目立たせる
- 危険な操作は赤色でハイライト
