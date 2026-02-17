# 監査ログ テーブル

## 概要

組織内の重要な操作を記録する監査ログテーブル。

## AuditLog

監査ログを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `organizationId` | UUID | YES | NULL | 組織 ID（外部キー）※1 |
| `userId` | UUID | YES | NULL | 操作者ユーザー ID（外部キー） |
| `category` | ENUM | NO | - | イベントカテゴリ |
| `action` | VARCHAR(100) | NO | - | アクション名 |
| `targetType` | VARCHAR(50) | YES | NULL | 対象リソースタイプ |
| `targetId` | UUID | YES | NULL | 対象リソース ID |
| `details` | JSONB | YES | NULL | 詳細情報 |
| `ipAddress` | VARCHAR(45) | YES | NULL | IP アドレス（IPv6 対応） |
| `userAgent` | TEXT | YES | NULL | ユーザーエージェント |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

※1: 個人アカウントの操作は `organizationId` が NULL

### イベントカテゴリ

| カテゴリ | 説明 | 対象イベント |
|----------|------|--------------|
| `AUTH` | 認証 | ログイン、ログアウト、OAuth 連携追加/解除 |
| `USER` | ユーザー | プロフィール変更、アカウント削除 |
| `ORGANIZATION` | 組織 | 組織作成、設定変更、削除 |
| `MEMBER` | メンバー | 招待、ロール変更、削除 |
| `PROJECT` | プロジェクト | 作成、設定変更、メンバー変更、削除 |
| `API_TOKEN` | API トークン | 作成、削除 |

### アクション例

| カテゴリ | アクション |
|----------|------------|
| AUTH | `login`, `logout`, `oauth_link`, `oauth_unlink` |
| USER | `profile_update`, `account_delete` |
| ORGANIZATION | `create`, `update`, `delete` |
| MEMBER | `invite`, `role_change`, `remove` |
| PROJECT | `create`, `update`, `member_add`, `member_remove`, `delete` |
| API_TOKEN | `create`, `revoke` |

### 詳細情報構造

```json
{
  "before": {
    "role": "MEMBER"
  },
  "after": {
    "role": "ADMIN"
  },
  "email": "user@example.com"
}
```

### ログ保持期間

| 対象 | 保持期間 |
|------|----------|
| 全ユーザー・組織 | 90日 |

※ 保持期間を超えたログは日次バッチで自動削除

### Prisma スキーマ

```prisma
enum AuditLogCategory {
  AUTH
  USER
  ORGANIZATION
  MEMBER
  PROJECT
  API_TOKEN
}

model AuditLog {
  id             String           @id @default(uuid()) @db.Uuid
  organizationId String?          @db.Uuid
  userId         String?          @db.Uuid
  category       AuditLogCategory
  action         String           @db.VarChar(100)
  targetType     String?          @db.VarChar(50)
  targetId       String?          @db.Uuid
  details        Json?
  ipAddress      String?          @db.VarChar(45)
  userAgent      String?
  createdAt      DateTime         @default(now())

  organization Organization? @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  user         User?         @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([organizationId])
  @@index([userId])
  @@index([category])
  @@index([createdAt])
  @@index([organizationId, createdAt])
}
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| AUD-001 | 操作ログ記録 | 重要な操作（ログイン、権限変更等）を記録 |
| AUD-002 | 監査ログ閲覧 | 組織の監査ログを閲覧（Admin以上） |
| AUD-003 | ログフィルタ | 日時、ユーザー、操作種別でフィルタ |
| AUD-004 | ログエクスポート | CSV 形式でログをエクスポート |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連](./auth.md)
- [組織・プロジェクト](./organization.md)
