# 通知テーブル

## 概要

ユーザーへの通知と通知設定を管理するテーブル。

## Notification

通知を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | NO | - | 通知先ユーザー ID（外部キー） |
| `type` | ENUM | NO | - | 通知種別 |
| `title` | VARCHAR(255) | NO | - | 通知タイトル |
| `body` | TEXT | NO | - | 通知本文 |
| `data` | JSONB | YES | NULL | 追加データ（リンク先等） |
| `readAt` | TIMESTAMP | YES | NULL | 既読日時 |
| `emailSentAt` | TIMESTAMP | YES | NULL | メール送信日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 通知種別

| 種別 | 説明 | デフォルト |
|------|------|:----------:|
| `ORG_INVITATION` | 組織への招待 | ON |
| `INVITATION_ACCEPTED` | 招待の承諾 | ON |
| `PROJECT_ADDED` | プロジェクトへの追加 | ON |
| `REVIEW_COMMENT` | レビューコメント | ON |
| `TEST_COMPLETED` | テスト実行完了 | ON |
| `TEST_FAILED` | テスト実行失敗 | ON |
| `USAGE_ALERT` | 使用量アラート（80%） | ON |
| `BILLING` | 課金通知 | ON |
| `SECURITY_ALERT` | セキュリティアラート | ON |

### 追加データ構造

```json
{
  "organizationId": "uuid",
  "projectId": "uuid",
  "testCaseId": "uuid",
  "url": "/orgs/my-org/projects/123"
}
```

### Prisma スキーマ

```prisma
enum NotificationType {
  ORG_INVITATION
  INVITATION_ACCEPTED
  PROJECT_ADDED
  REVIEW_COMMENT
  TEST_COMPLETED
  TEST_FAILED
  USAGE_ALERT
  BILLING
  SECURITY_ALERT
}

model Notification {
  id          String           @id @default(uuid()) @db.Uuid
  userId      String           @db.Uuid
  type        NotificationType
  title       String           @db.VarChar(255)
  body        String
  data        Json?
  readAt      DateTime?
  emailSentAt DateTime?
  createdAt   DateTime         @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, readAt])
  @@index([createdAt])
}
```

---

## NotificationPreference

通知設定を管理するテーブル。ユーザーごとに通知種別ごとの設定を保持。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `type` | ENUM | NO | - | 通知種別 |
| `emailEnabled` | BOOLEAN | NO | true | メール通知の有効/無効 |
| `inAppEnabled` | BOOLEAN | NO | true | アプリ内通知の有効/無効 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 制約

- `userId` + `type` は一意

### Prisma スキーマ

```prisma
model NotificationPreference {
  id           String           @id @default(uuid()) @db.Uuid
  userId       String           @db.Uuid
  type         NotificationType
  emailEnabled Boolean          @default(true)
  inAppEnabled Boolean          @default(true)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type])
  @@index([userId])
}
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| NTF-001 | メール通知設定 | 通知種別ごとのメール通知 ON/OFF |
| NTF-002 | アプリ内通知 | Web アプリ内での通知表示 |
| NTF-003 | 通知一覧 | 過去の通知一覧を表示 |
| NTF-004 | 通知既読管理 | 通知の既読/未読を管理 |
| NTF-005 | 組織通知設定 | 組織単位での通知設定（Admin） |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [認証関連](./auth.md)
- [組織・プロジェクト](./organization.md)
