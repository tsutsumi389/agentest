# Phase 2: 組織・権限管理 実装プラン

## 概要

Phase 2では、チーム利用の基盤となる組織・権限管理機能を実装する。

**対象機能:**
- 順序 4: 組織作成・設定 (ORG-001, ORG-002)
- 順序 5: メンバー招待・管理 (MBR-001〜007)
- 順序 6: ロール・権限管理 (ROL-001〜005, AU-002, AU-003)
- 順序 7: 組織一覧・削除 (ORG-003, ORG-004, ORG-005)

**スコープ決定:**
- 監査ログ機能: 含める
- メール送信: 含めない（招待リンクはUIに表示）

---

## 現状分析

### 実装済み（バックエンド）
| 機能 | ファイル |
|------|----------|
| 組織CRUD | `apps/api/src/routes/organizations.ts` |
| メンバー一覧 | `OrganizationService.getMembers()` |
| 招待送信・承諾 | `OrganizationService.invite()`, `acceptInvitation()` |
| ロール更新・削除 | `OrganizationService.updateMemberRole()`, `removeMember()` |

### 未実装
| 機能 | 種別 |
|------|------|
| 招待一覧・取消・辞退 | API |
| オーナー権限移譲 | API |
| 監査ログ記録・取得 | API + サービス |
| 組織管理UI全般 | フロントエンド |

---

## 実装ステップ

### Step 1: 監査ログサービス（バックエンド）

**新規ファイル:**
- `apps/api/src/services/audit-log.service.ts`
- `apps/api/src/repositories/audit-log.repository.ts`

**実装内容:**
```typescript
// AuditLogService
log(params: {
  userId?: string;
  organizationId?: string;
  category: AuditLogCategory;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void>

getByOrganization(organizationId: string, options: {
  page?: number;
  limit?: number;
  category?: AuditLogCategory;
  startDate?: Date;
  endDate?: Date;
}): Promise<{ logs: AuditLog[]; total: number }>
```

---

### Step 2: 招待関連API追加（バックエンド）

**変更ファイル:** `apps/api/src/routes/organizations.ts`

| エンドポイント | メソッド | 権限 |
|----------------|---------|------|
| `/:organizationId/invitations` | GET | OWNER, ADMIN |
| `/:organizationId/invitations/:invitationId` | DELETE | OWNER, ADMIN |
| `/invitations/:token/decline` | POST | 認証済み |

**サービス追加:**
```typescript
// OrganizationService
getPendingInvitations(organizationId: string): Promise<OrganizationInvitation[]>
cancelInvitation(invitationId: string): Promise<void>
declineInvitation(token: string, userId: string): Promise<void>
```

---

### Step 3: オーナー権限移譲API（バックエンド）

**エンドポイント:** `POST /:organizationId/transfer-ownership`

**実装:**
```typescript
// OrganizationService
transferOwnership(organizationId: string, currentOwnerId: string, newOwnerId: string): Promise<void>
// 1. 新オーナーがメンバーか確認
// 2. トランザクションで現オーナー→ADMIN、新オーナー→OWNER
// 3. 監査ログ記録
```

---

### Step 4: 監査ログ取得API（バックエンド）

**エンドポイント:** `GET /:organizationId/audit-logs`
**権限:** OWNER, ADMIN

---

### Step 5: 既存APIへの監査ログ組み込み（バックエンド）

**対象サービス:**
- `apps/api/src/services/organization.service.ts`
  - create, update, softDelete
  - invite, acceptInvitation, declineInvitation, cancelInvitation
  - updateMemberRole, removeMember, transferOwnership

各操作の末尾で `AuditLogService.log()` を呼び出し。

---

### Step 6: フロントエンド基盤

**新規ファイル:**
- `apps/web/src/stores/organization.ts` - 組織ストア
- `apps/web/src/contexts/OrganizationContext.tsx` - 組織選択コンテキスト

**APIクライアント拡張:** `apps/web/src/lib/api.ts`
```typescript
export const organizationsApi = {
  list: () => ...,
  create: (data) => ...,
  getById: (orgId) => ...,
  update: (orgId, data) => ...,
  delete: (orgId) => ...,
  getMembers: (orgId) => ...,
  invite: (orgId, data) => ...,
  getInvitations: (orgId) => ...,
  cancelInvitation: (orgId, invitationId) => ...,
  acceptInvitation: (token) => ...,
  declineInvitation: (token) => ...,
  updateMemberRole: (orgId, userId, role) => ...,
  removeMember: (orgId, userId) => ...,
  transferOwnership: (orgId, newOwnerId) => ...,
  getAuditLogs: (orgId, params) => ...,
};
```

---

### Step 7: ナビゲーション更新

**変更ファイル:** `apps/web/src/components/layout-parts/SlideoverMenu.tsx`

組織セレクター（ドロップダウン）を追加:
- 「個人」と所属組織の切り替え
- 「+ 組織を作成」リンク
- 組織設定へのリンク

---

### Step 8: 組織一覧ページ

**新規ファイル:** `apps/web/src/pages/Organizations.tsx`

**ルート追加:** `apps/web/src/App.tsx`
```typescript
<Route path="organizations" element={<OrganizationsPage />} />
```

**UI構成:**
- 所属組織のカード一覧
- 各カードに組織名、ロール、メンバー数を表示
- 「組織を作成」ボタン

---

### Step 9: 組織作成モーダル

**新規ファイル:** `apps/web/src/components/organization/CreateOrganizationModal.tsx`

**フィールド:**
- 組織名（必須）
- スラッグ（必須、自動生成可）
- 説明（任意）

---

### Step 10: 組織設定ページ

**新規ファイル:** `apps/web/src/pages/OrganizationSettings.tsx`

**ルート追加:**
```typescript
<Route path="organizations/:organizationId/settings" element={<OrganizationSettingsPage />} />
```

**タブ構成:**
1. **一般** - 組織名、説明、請求先メール
2. **メンバー** - メンバー一覧、ロール変更、削除
3. **招待** - 保留中招待一覧、新規招待、取消
4. **監査ログ** - 操作履歴の閲覧
5. **危険な操作** - オーナー移譲、組織削除

---

### Step 11: メンバー管理タブ

**新規コンポーネント:** `apps/web/src/components/organization/MemberList.tsx`

**機能:**
- メンバー一覧（アバター、名前、メール、ロール、参加日）
- ロール変更ドロップダウン
- メンバー削除（確認ダイアログ付き）

---

### Step 12: 招待管理タブ

**新規コンポーネント:**
- `apps/web/src/components/organization/InvitationList.tsx`
- `apps/web/src/components/organization/InviteMemberModal.tsx`

**機能:**
- 保留中招待一覧（メール、ロール、有効期限）
- 招待取消ボタン
- 新規招待モーダル（メール入力、ロール選択）
- 招待リンクのコピー機能

---

### Step 13: 招待承諾ページ

**新規ファイル:** `apps/web/src/pages/InvitationAccept.tsx`

**ルート追加:**
```typescript
<Route path="invitations/:token" element={<InvitationAcceptPage />} />
```

**フロー:**
1. トークンから招待情報を取得
2. 未ログインの場合はログインを促す
3. 承諾/辞退ボタン表示

---

### Step 14: 監査ログ閲覧タブ

**新規コンポーネント:** `apps/web/src/components/organization/AuditLogList.tsx`

**機能:**
- 操作履歴一覧（日時、ユーザー、カテゴリ、アクション、詳細）
- フィルタ（カテゴリ、期間）
- ページネーション

---

### Step 15: 危険な操作タブ

**新規コンポーネント:**
- `apps/web/src/components/organization/TransferOwnershipModal.tsx`
- `apps/web/src/components/organization/DeleteOrganizationModal.tsx`

**機能:**
- オーナー移譲（メンバー選択、確認ダイアログ）
- 組織削除（組織名入力による確認）

---

## ファイル一覧

### 新規作成

**バックエンド:**
```
apps/api/src/services/audit-log.service.ts
apps/api/src/repositories/audit-log.repository.ts
```

**フロントエンド:**
```
apps/web/src/stores/organization.ts
apps/web/src/contexts/OrganizationContext.tsx
apps/web/src/pages/Organizations.tsx
apps/web/src/pages/OrganizationSettings.tsx
apps/web/src/pages/InvitationAccept.tsx
apps/web/src/components/organization/OrganizationCard.tsx
apps/web/src/components/organization/OrganizationSelector.tsx
apps/web/src/components/organization/MemberList.tsx
apps/web/src/components/organization/InvitationList.tsx
apps/web/src/components/organization/AuditLogList.tsx
apps/web/src/components/organization/CreateOrganizationModal.tsx
apps/web/src/components/organization/InviteMemberModal.tsx
apps/web/src/components/organization/TransferOwnershipModal.tsx
apps/web/src/components/organization/DeleteOrganizationModal.tsx
```

### 変更

**バックエンド:**
```
apps/api/src/routes/organizations.ts
apps/api/src/controllers/organization.controller.ts
apps/api/src/services/organization.service.ts
```

**フロントエンド:**
```
apps/web/src/App.tsx
apps/web/src/lib/api.ts
apps/web/src/components/Layout.tsx
apps/web/src/components/layout-parts/SlideoverMenu.tsx
```

---

## 注意事項

1. **招待リンクの表示**
   - メール送信は未実装のため、招待作成後にリンクをモーダルで表示
   - クリップボードへのコピー機能を実装

2. **論理削除の猶予期間**
   - 組織削除は30日後に物理削除されることをUIで明示

3. **権限継承**
   - 組織Adminは全プロジェクトに対してAdmin権限を持つ
   - この動作はミドルウェア側で既に実装済み

4. **デザインガイドライン**
   - Terminal/CLI風のミニマルデザインを維持
   - 既存のSettings.tsxのタブUIパターンを踏襲
