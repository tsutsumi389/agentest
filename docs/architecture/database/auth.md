# 認証関連テーブル

## 概要

OAuth ログイン（GitHub, Google）とセッション管理のためのテーブル。

## User

ユーザー情報を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `email` | VARCHAR(255) | NO | - | メールアドレス（一意） |
| `name` | VARCHAR(100) | NO | - | 表示名 |
| `avatarUrl` | TEXT | YES | NULL | アバター画像 URL |
| `plan` | ENUM | NO | FREE | 個人プラン（FREE, PRO） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除、30日後に物理削除） |

### 個人プラン

| プラン | 説明 |
|--------|------|
| `FREE` | 無料プラン（個人利用・評価目的） |
| `PRO` | 有料プラン $10/月（個人の本格利用） |

### 制約

- `email` は一意
- `email` は有効なメールアドレス形式

### Prisma スキーマ

```prisma
enum UserPlan {
  FREE
  PRO
}

model User {
  id        String    @id @default(uuid()) @db.Uuid
  email     String    @unique @db.VarChar(255)
  name      String    @db.VarChar(100)
  avatarUrl String?
  plan      UserPlan  @default(FREE)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  accounts              Account[]
  refreshTokens         RefreshToken[]
  sessions              Session[]
  organizationMembers   OrganizationMember[]
  ownedProjects         Project[]            @relation("ProjectOwner")
  executions            Execution[]
  reviewComments        ReviewComment[]
  reviewCommentReplies  ReviewCommentReply[]
  editLocks             EditLock[]
  uploadedEvidences     ExecutionEvidence[]
  projectHistories      ProjectHistory[]
  testSuiteHistories    TestSuiteHistory[]
  testCaseHistories     TestCaseHistory[]
  apiTokens             ApiToken[]
  subscription          Subscription?
  notifications         Notification[]
  notificationPrefs     NotificationPreference[]
  auditLogs             AuditLog[]
  usageRecords          UsageRecord[]
}
```

---

## Account

OAuth プロバイダーアカウントを管理するテーブル。1ユーザーに対して複数のプロバイダーアカウントを紐付け可能。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `provider` | VARCHAR(50) | NO | - | プロバイダー名（github, google） |
| `providerAccountId` | VARCHAR(255) | NO | - | プロバイダー側のアカウント ID |
| `accessToken` | TEXT | YES | NULL | アクセストークン（暗号化） |
| `refreshToken` | TEXT | YES | NULL | リフレッシュトークン（暗号化） |
| `expiresAt` | TIMESTAMP | YES | NULL | トークン有効期限 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 制約

- `userId` + `provider` は一意（同一プロバイダーの重複登録不可）
- `provider` + `providerAccountId` は一意

### Prisma スキーマ

```prisma
model Account {
  id                String    @id @default(uuid()) @db.Uuid
  userId            String    @db.Uuid
  provider          String    @db.VarChar(50)
  providerAccountId String    @db.VarChar(255)
  accessToken       String?
  refreshToken      String?
  expiresAt         DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

---

## RefreshToken

JWT リフレッシュトークンを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `token` | VARCHAR(500) | NO | - | トークン値（ハッシュ化） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `revokedAt` | TIMESTAMP | YES | NULL | 失効日時 |

### 制約

- `token` は一意

### Prisma スキーマ

```prisma
model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @db.Uuid
  token     String    @unique @db.VarChar(500)
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}
```

---

## Session

ユーザーのログインセッションを管理するテーブル。アクティブセッションの確認・無効化に使用。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `token` | VARCHAR(500) | NO | - | セッショントークン（ハッシュ化） |
| `userAgent` | TEXT | YES | NULL | ブラウザ / クライアント情報 |
| `ipAddress` | VARCHAR(45) | YES | NULL | IP アドレス（IPv6 対応） |
| `lastActiveAt` | TIMESTAMP | NO | now() | 最終アクティブ日時 |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `revokedAt` | TIMESTAMP | YES | NULL | 失効日時 |

### セッション有効期限

| 条件 | 有効期限 |
|------|----------|
| 通常ログイン | 7日間 |
| Remember Me | 30日間 |

### 制約

- `token` は一意

### Prisma スキーマ

```prisma
model Session {
  id           String    @id @default(uuid()) @db.Uuid
  userId       String    @db.Uuid
  token        String    @unique @db.VarChar(500)
  userAgent    String?
  ipAddress    String?   @db.VarChar(45)
  lastActiveAt DateTime  @default(now())
  expiresAt    DateTime
  createdAt    DateTime  @default(now())
  revokedAt    DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
  @@index([expiresAt])
}
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| USR-001 | ユーザー登録 | GitHub / Google OAuth でアカウント作成 |
| USR-002 | プロフィール設定 | 表示名、アバター、メールアドレスの設定 |
| USR-003 | OAuth 連携追加 | 既存アカウントに別の OAuth プロバイダーを追加 |
| USR-004 | OAuth 連携解除 | 連携済みプロバイダーの解除（最低1つは必須） |
| USR-005 | セッション管理 | アクティブセッションの確認・無効化 |
| USR-006 | アカウント削除 | 自身のアカウントを削除（30日後に物理削除） |
| USR-007 | 個人プラン選択 | Free / Pro プランの選択・変更 |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [組織・プロジェクト](./organization.md)
- [API トークン](./api-token.md)
- [課金・サブスクリプション](./billing.md)
