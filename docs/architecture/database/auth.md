# 認証関連テーブル

## 概要

メール/パスワード認証、OAuth ログイン（GitHub, Google）、セッション管理のためのテーブル。

## User

ユーザー情報を管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `email` | VARCHAR(255) | NO | - | メールアドレス（一意） |
| `name` | VARCHAR(100) | NO | - | 表示名 |
| `avatarUrl` | TEXT | YES | NULL | アバター画像 URL |
| `passwordHash` | VARCHAR(255) | YES | NULL | bcryptパスワードハッシュ（OAuthのみのユーザーはNULL） |
| `emailVerified` | BOOLEAN | NO | false | メールアドレス確認済みフラグ |
| `totpSecret` | VARCHAR(255) | YES | NULL | TOTP秘密鍵（AES-256-GCM暗号化） |
| `totpEnabled` | BOOLEAN | NO | false | 2FA有効フラグ |
| `failedAttempts` | INT | NO | 0 | ログイン連続失敗回数 |
| `lockedUntil` | TIMESTAMP | YES | NULL | アカウントロック解除日時 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `updatedAt` | TIMESTAMP | NO | now() | 更新日時 |
| `deletedAt` | TIMESTAMP | YES | NULL | 削除日時（論理削除、30日後に物理削除） |

### 制約

- `email` は一意
- `email` は有効なメールアドレス形式

### Prisma スキーマ

```prisma
model User {
  id             String    @id @default(uuid()) @db.Uuid
  email          String    @unique @db.VarChar(255)
  name           String    @db.VarChar(100)
  avatarUrl      String?
  passwordHash   String?   @map("password_hash") @db.VarChar(255)
  emailVerified  Boolean   @default(false) @map("email_verified")
  totpSecret     String?   @map("totp_secret") @db.VarChar(255)
  totpEnabled    Boolean   @default(false) @map("totp_enabled")
  failedAttempts Int       @default(0) @map("failed_attempts")
  lockedUntil    DateTime? @map("locked_until")
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  deletedAt      DateTime?

  accounts              Account[]
  refreshTokens         RefreshToken[]
  sessions              Session[]
  passwordResetTokens        PasswordResetToken[]
  emailVerificationTokens    EmailVerificationToken[]
  organizationMembers        OrganizationMember[]
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
  notifications         Notification[]
  notificationPrefs     NotificationPreference[]
  auditLogs             AuditLog[]
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
| `tokenHash` | VARCHAR(64) | NO | - | トークンの SHA-256 ハッシュ値（hex、64文字） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限 |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |
| `revokedAt` | TIMESTAMP | YES | NULL | 失効日時 |

### 制約

- `tokenHash` は一意

### トークン保存方式

- 生トークンは Cookie にのみ保持し、DB には SHA-256 ハッシュのみ保存
- 検証フロー: Cookie から生トークン取得 → `hashToken()` で SHA-256 ハッシュ化 → DB でハッシュ検索

### Prisma スキーマ

```prisma
model RefreshToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
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
| `tokenHash` | VARCHAR(64) | NO | - | セッショントークンの SHA-256 ハッシュ値（hex、64文字） |
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

- `tokenHash` は一意

### トークン保存方式

- 生トークンは Cookie にのみ保持し、DB には SHA-256 ハッシュのみ保存
- 検証フロー: Cookie から生トークン取得 → `hashToken()` で SHA-256 ハッシュ化 → DB でハッシュ検索

### Prisma スキーマ

```prisma
model Session {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  tokenHash    String    @unique @map("token_hash") @db.VarChar(64)
  userAgent    String?   @map("user_agent")
  ipAddress    String?   @map("ip_address") @db.VarChar(45)
  lastActiveAt DateTime  @default(now()) @map("last_active_at")
  expiresAt    DateTime  @map("expires_at")
  revokedAt    DateTime? @map("revoked_at")
  createdAt    DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("sessions")
}
```

---

## PasswordResetToken

パスワードリセットトークンを管理するテーブル。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `tokenHash` | VARCHAR(64) | NO | - | トークンの SHA-256 ハッシュ値（hex、64文字） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限（作成から1時間後） |
| `usedAt` | TIMESTAMP | YES | NULL | 使用日時（使用済みマーク） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 制約

- `tokenHash` は一意
- `userId` に対する外部キー（Cascade 削除）

### トークン保存方式

- 生トークン（32バイトランダムhex）はメールのリンクにのみ含まれ、DB には SHA-256 ハッシュのみ保存
- 検証フロー: URLから生トークン取得 → `hashToken()` で SHA-256 ハッシュ化 → DB でハッシュ検索
- 使用済みトークン（`usedAt` が設定済み）は再利用不可
- 期限切れトークン（`expiresAt` が過去）は無効

### Prisma スキーマ

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("password_reset_tokens")
}
```

---

## EmailVerificationToken

メールアドレス確認トークンを管理するテーブル。新規登録時に確認メールとともにトークンを発行し、メールアドレスの所有を確認する。

### カラム定義

| カラム | 型 | NULL | デフォルト | 説明 |
|--------|------|------|------------|------|
| `id` | UUID | NO | gen_random_uuid() | 主キー |
| `userId` | UUID | NO | - | ユーザー ID（外部キー） |
| `tokenHash` | VARCHAR(64) | NO | - | トークンの SHA-256 ハッシュ値（hex、64文字） |
| `expiresAt` | TIMESTAMP | NO | - | 有効期限（作成から24時間後） |
| `usedAt` | TIMESTAMP | YES | NULL | 使用日時（使用済みマーク） |
| `createdAt` | TIMESTAMP | NO | now() | 作成日時 |

### 制約

- `tokenHash` は一意
- `userId` に対する外部キー（Cascade 削除）

### トークン保存方式

- 生トークン（32バイトランダムhex）は確認メールのリンクにのみ含まれ、DB には SHA-256 ハッシュのみ保存
- 検証フロー: URLから生トークン取得 → `hashToken()` で SHA-256 ハッシュ化 → DB でハッシュ検索
- 使用済みトークン（`usedAt` が設定済み）は再利用不可
- 期限切れトークン（`expiresAt` が過去）は無効
- 確認メール再送信時、既存の未使用トークンは無効化される

### Prisma スキーマ

```prisma
model EmailVerificationToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
  @@map("email_verification_tokens")
}
```

---

## 関連機能

| 機能 ID | 機能 | 説明 |
|---------|------|------|
| USR-001 | ユーザー登録 | メール/パスワードまたは GitHub / Google OAuth でアカウント作成 |
| USR-002 | プロフィール設定 | 表示名、アバター、メールアドレスの設定 |
| USR-003 | OAuth 連携追加 | 既存アカウントに別の OAuth プロバイダーを追加 |
| USR-004 | OAuth 連携解除 | 連携済みプロバイダーの解除（パスワード設定済みなら全解除可能） |
| USR-005 | セッション管理 | アクティブセッションの確認・無効化 |
| USR-006 | アカウント削除 | 自身のアカウントを削除（30日後に物理削除） |

## 関連ドキュメント

- [テーブル一覧](./index.md)
- [組織・プロジェクト](./organization.md)
- [API トークン](./api-token.md)
