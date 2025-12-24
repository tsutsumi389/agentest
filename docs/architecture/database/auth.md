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
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |

### 制約

- `email` は一意
- `email` は有効なメールアドレス形式

### Prisma スキーマ

```prisma
model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique @db.VarChar(255)
  name      String   @db.VarChar(100)
  avatarUrl String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  accounts              Account[]
  refreshTokens         RefreshToken[]
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

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| AU-001 | OAuth ログイン | GitHub / Google アカウントでログイン |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [組織・プロジェクト](./organization.md)
