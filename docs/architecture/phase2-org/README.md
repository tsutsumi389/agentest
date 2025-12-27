# Phase 2: 組織・権限管理 詳細設計書

## 概要

Phase 2 では、チーム利用の基盤となる組織・権限管理機能を構築する。組織の作成・管理、メンバー招待、ロールベースのアクセス制御、監査ログ機能を提供する。

## 機能一覧

| 機能 ID | 機能名 | 説明 | 状態 |
|---------|--------|------|------|
| ORG-001 | 組織作成 | 新規組織の作成 | 実装済 |
| ORG-002 | 組織設定 | 組織名、説明、請求先メールの編集 | 実装済 |
| ORG-003 | 組織一覧 | 所属組織の一覧表示 | 実装済 |
| ORG-004 | 組織削除 | 組織の論理削除（30日猶予） | 実装済 |
| ORG-005 | 組織復元 | 削除済み組織の復元 | 実装済 |
| MBR-001 | メンバー招待 | メールアドレスでメンバーを招待 | 実装済 |
| MBR-002 | 招待承諾 | トークンベースの招待承諾 | 実装済 |
| MBR-003 | 招待辞退 | 招待の辞退 | 実装済 |
| MBR-004 | 招待取消 | 保留中招待のキャンセル | 実装済 |
| MBR-005 | 招待一覧 | 保留中招待の一覧表示 | 実装済 |
| MBR-006 | メンバー一覧 | 組織メンバーの一覧表示 | 実装済 |
| MBR-007 | メンバー削除 | 組織からメンバーを削除 | 実装済 |
| ROL-001 | ロール変更 | メンバーのロール変更 | 実装済 |
| ROL-002 | オーナー移譲 | オーナー権限の移譲 | 実装済 |
| AU-002 | 監査ログ記録 | 組織操作の監査ログ記録 | 実装済 |
| AU-003 | 監査ログ閲覧 | 監査ログの閲覧・フィルタ | 実装済 |

## アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  pages/                │  contexts/           │  stores/        │
│  ├─ Organizations      │  └─ Organization     │  └─ organization│
│  ├─ OrganizationSettings│    Context          │     (Zustand)   │
│  └─ InvitationAccept   │                      │                 │
├─────────────────────────────────────────────────────────────────┤
│  components/organization/                                       │
│  ├─ OrganizationSelector  ├─ MemberList       ├─ AuditLogList  │
│  ├─ OrganizationCard      ├─ InvitationList   ├─ TransferModal │
│  ├─ CreateOrgModal        ├─ InviteMemberModal├─ DeleteModal   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ HTTP (Cookie-based Auth)
┌─────────────────────────────────────────────────────────────────┐
│                        Backend (Express)                        │
├─────────────────────────────────────────────────────────────────┤
│  routes/               │  controllers/        │  services/      │
│  └─ organizations.ts   │  └─ organization     │  ├─ organization│
│                        │                      │  └─ audit-log   │
├─────────────────────────────────────────────────────────────────┤
│  middleware/           │  repositories/       │  packages/auth/ │
│  └─ requireOrgRole     │  ├─ organization     │  └─ middleware  │
│                        │  └─ audit-log        │                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ Prisma ORM
┌─────────────────────────────────────────────────────────────────┐
│                        PostgreSQL                               │
├─────────────────────────────────────────────────────────────────┤
│  Organization │ OrganizationMember │ OrganizationInvitation     │
│  AuditLog                                                       │
└─────────────────────────────────────────────────────────────────┘
```

## ロールと権限

### 組織ロール

| ロール | 説明 | 権限 |
|--------|------|------|
| OWNER | 組織オーナー | 全操作可能（削除、オーナー移譲含む） |
| ADMIN | 管理者 | メンバー管理、設定変更（削除、移譲除く） |
| MEMBER | 一般メンバー | 閲覧のみ |

### 権限マトリクス

| 操作 | OWNER | ADMIN | MEMBER |
|------|-------|-------|--------|
| 組織情報閲覧 | ✓ | ✓ | ✓ |
| 組織設定変更 | ✓ | ✓ | - |
| メンバー一覧 | ✓ | ✓ | ✓ |
| メンバー招待 | ✓ | ✓ | - |
| 招待取消 | ✓ | ✓ | - |
| ロール変更 | ✓ | ✓* | - |
| メンバー削除 | ✓ | ✓* | - |
| 監査ログ閲覧 | ✓ | ✓ | - |
| オーナー移譲 | ✓ | - | - |
| 組織削除 | ✓ | - | - |
| 組織復元 | ✓ | - | - |

*ADMIN は他の ADMIN/MEMBER のみ操作可能（OWNER は操作不可）

## 招待フロー

```
招待者          Backend            招待対象者
   │               │                   │
   │  1. 招待送信   │                   │
   │  (email,role) │                   │
   │──────────────>│                   │
   │               │                   │
   │  2. トークン生成│                   │
   │  (UUID, 7日有効)│                   │
   │               │                   │
   │  3. 招待URL返却│                   │
   │<──────────────│                   │
   │               │                   │
   │  4. 招待URLを共有（UIでコピー）     │
   │─────────────────────────────────>│
   │               │                   │
   │               │  5. URL アクセス   │
   │               │<──────────────────│
   │               │                   │
   │               │  6. 招待情報表示   │
   │               │──────────────────>│
   │               │                   │
   │               │  7. 承諾/辞退      │
   │               │<──────────────────│
   │               │                   │
   │               │  8. メンバー作成   │
   │               │  (承諾時のみ)      │
```

## 監査ログ

### カテゴリ

| カテゴリ | 説明 | アイコン |
|----------|------|----------|
| AUTH | 認証関連 | Shield |
| USER | ユーザー操作 | User |
| ORGANIZATION | 組織操作 | Building2 |
| MEMBER | メンバー操作 | Users |
| PROJECT | プロジェクト操作 | FolderKanban |
| API_TOKEN | APIトークン操作 | Key |
| BILLING | 請求関連 | CreditCard |

### 記録アクション

| アクション | カテゴリ | 記録情報 |
|-----------|---------|----------|
| organization.created | ORGANIZATION | name, slug |
| organization.updated | ORGANIZATION | 更新項目 |
| organization.deleted | ORGANIZATION | name, slug |
| organization.restored | ORGANIZATION | name, slug |
| organization.ownership_transferred | ORGANIZATION | previousOwnerId, newOwnerId |
| member.invited | MEMBER | email, role |
| member.invitation_accepted | MEMBER | email, role |
| member.invitation_cancelled | MEMBER | email, role |
| member.invitation_declined | MEMBER | email |
| member.role_updated | MEMBER | targetUserId, previousRole, newRole |
| member.removed | MEMBER | targetUserId, email, role |

## ディレクトリ構成

### Backend

```
apps/api/src/
├── controllers/
│   └── organization.controller.ts   # 組織 CRUD、メンバー管理
├── services/
│   ├── organization.service.ts      # 組織ビジネスロジック
│   └── audit-log.service.ts         # 監査ログ記録・取得
├── repositories/
│   ├── organization.repository.ts   # 組織 DB 操作
│   └── audit-log.repository.ts      # 監査ログ DB 操作
└── routes/
    └── organizations.ts             # 組織関連ルート

packages/auth/src/
└── middleware.ts                    # requireOrgRole ミドルウェア

packages/shared/src/
├── config/
│   └── constants.ts                 # DELETION_GRACE_PERIOD_DAYS
└── types/
    └── organization.ts              # 組織関連型定義
```

### Frontend

```
apps/web/src/
├── pages/
│   ├── Organizations.tsx            # 組織一覧ページ
│   ├── OrganizationSettings.tsx     # 組織設定ページ
│   └── InvitationAccept.tsx         # 招待承諾ページ
├── contexts/
│   └── OrganizationContext.tsx      # 組織選択コンテキスト
├── stores/
│   └── organization.ts              # 組織ストア（Zustand）
├── lib/
│   └── api.ts                       # organizationsApi
└── components/organization/
    ├── OrganizationSelector.tsx     # ナビゲーション用セレクター
    ├── OrganizationCard.tsx         # 組織カード
    ├── CreateOrganizationModal.tsx  # 組織作成モーダル
    ├── MemberList.tsx               # メンバー一覧
    ├── InvitationList.tsx           # 招待一覧
    ├── InviteMemberModal.tsx        # メンバー招待モーダル
    ├── AuditLogList.tsx             # 監査ログ一覧
    ├── TransferOwnershipModal.tsx   # オーナー移譲モーダル
    └── DeleteOrganizationModal.tsx  # 組織削除モーダル
```

## データモデル

### Organization

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| name | VARCHAR(100) | 組織名 |
| slug | VARCHAR(50) | スラッグ（一意） |
| description | TEXT | 説明 |
| avatarUrl | VARCHAR(255) | アバター URL |
| plan | OrganizationPlan | プラン（TEAM/ENTERPRISE） |
| billingEmail | VARCHAR(255) | 請求先メール |
| createdAt | TIMESTAMP | 作成日時 |
| updatedAt | TIMESTAMP | 更新日時 |
| deletedAt | TIMESTAMP | 論理削除日時 |

### OrganizationMember

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| organizationId | UUID | 組織 ID（FK） |
| userId | UUID | ユーザー ID（FK） |
| role | OrganizationRole | ロール（OWNER/ADMIN/MEMBER） |
| joinedAt | TIMESTAMP | 参加日時 |

### OrganizationInvitation

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| organizationId | UUID | 組織 ID（FK） |
| email | VARCHAR(255) | 招待先メール |
| role | OrganizationRole | 付与ロール |
| token | VARCHAR(255) | 招待トークン（一意） |
| invitedByUserId | UUID | 招待者 ID（FK） |
| expiresAt | TIMESTAMP | 有効期限（7日） |
| acceptedAt | TIMESTAMP | 承諾日時 |
| declinedAt | TIMESTAMP | 辞退日時 |
| createdAt | TIMESTAMP | 作成日時 |

### AuditLog

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID | 主キー |
| organizationId | UUID | 組織 ID（FK、nullable） |
| userId | UUID | 操作者 ID（FK、nullable） |
| category | AuditLogCategory | カテゴリ |
| action | VARCHAR(100) | アクション名 |
| targetType | VARCHAR(50) | 対象タイプ |
| targetId | VARCHAR(255) | 対象 ID |
| details | JSON | 詳細情報 |
| ipAddress | VARCHAR(45) | IP アドレス |
| userAgent | TEXT | ユーザーエージェント |
| createdAt | TIMESTAMP | 作成日時 |

## 設定値

| 項目 | 値 | 説明 |
|------|-----|------|
| DELETION_GRACE_PERIOD_DAYS | 30 | 削除猶予期間（日） |
| INVITATION_EXPIRY_DAYS | 7 | 招待有効期限（日） |
| AUDIT_LOG_DEFAULT_LIMIT | 50 | 監査ログデフォルト取得件数 |
| AUDIT_LOG_MAX_LIMIT | 100 | 監査ログ最大取得件数 |

## 関連ドキュメント

### 詳細設計

| ドキュメント | 内容 |
|-------------|------|
| [バックエンド詳細設計](./backend.md) | サービス・コントローラ・リポジトリの詳細 |
| [フロントエンド詳細設計](./frontend.md) | コンポーネント・ストア・API クライアントの詳細 |
| [セキュリティ設計](./security.md) | 認可・監査ログの詳細 |

### API リファレンス

| ドキュメント | 内容 |
|-------------|------|
| [組織 API](../../api/organizations.md) | 組織 CRUD API |

### データモデル

| ドキュメント | 内容 |
|-------------|------|
| [組織関連テーブル](../database/organization.md) | Organization・Member・Invitation・AuditLog |
